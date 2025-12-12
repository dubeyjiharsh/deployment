import { NextRequest, NextResponse } from "next/server";
import { getCanvasById, saveCanvas } from "@/services/database/canvas-repository";
import { settingsRepository } from "@/services/database/settings-repository";
import type { ConflictResolution } from "@/stores/canvas-store";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import { auth } from "@/lib/auth";

const CLAUDE_MODEL = "claude-sonnet-4-20250514";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Apply authentication and rate limiting
  const { response } = await applyApiMiddleware(
    request,
    MIDDLEWARE_PRESETS.AI
  );
  if (response) return response;

  try {
    const body = await request.json();
    const { canvasId, conflictId, conflict } = body;

    if (!canvasId || !conflictId || !conflict) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get canvas
    const canvas = await getCanvasById(canvasId);
    if (!canvas) {
      return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
    }

    // Get affected fields
    const affectedFields: Record<string, unknown> = {};
    conflict.fieldKeys.forEach((key: string) => {
      if (canvas[key as keyof typeof canvas]) {
        affectedFields[key] = canvas[key as keyof typeof canvas];
      }
    });

    // Build context for AI
    const systemPrompt = `You are an expert business analyst helping resolve conflicts in a business canvas.

Analyze the conflict and suggest specific, actionable changes to the canvas fields to resolve it.

Return your response as a JSON object with this structure:
{
  "explanation": "Brief explanation of why this conflict exists (2-3 sentences)",
  "suggestedChanges": {
    "fieldKey": {
      "currentValue": "...",
      "suggestedValue": "...",
      "reason": "Why this change resolves the conflict"
    }
  },
  "priority": "high" | "medium" | "low"
}

Be specific and actionable. The suggested values should be complete replacements for the current field values.`;

    const userPrompt = `Conflict Details:
Type: ${conflict.conflictType}
Severity: ${conflict.severity}
Description: ${conflict.description}

Affected Fields:
${JSON.stringify(affectedFields, null, 2)}

Full Canvas Context:
Title: ${canvas.title.value}
Problem: ${canvas.problemStatement.value}
Solution: ${canvas.solutionRecommendation?.value || "Not specified"}
Timeline: ${JSON.stringify(canvas.timelines?.value || "Not specified")}
Resources: ${JSON.stringify(canvas.budgetResources?.value || "Not specified")}

Please analyze this conflict and suggest specific changes to resolve it.`;

    const settings = await settingsRepository.getSettings();
    const provider = settings?.llmProvider || "claude";

    let responseText: string;

    if (provider === "claude") {
      const apiKey = settings?.claudeApiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("Claude API key not configured");
      }

      const { anthropic } = await import("@ai-sdk/anthropic");
      const { generateText } = await import("ai");

      const model = anthropic(CLAUDE_MODEL);

      const { text } = await generateText({
        model,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.7,
        maxOutputTokens: 2048,
      });

      responseText = text;
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    // Parse the AI response
    let resolution: ConflictResolution;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        resolution = JSON.parse(jsonMatch[0]) as ConflictResolution;
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Fallback: create a basic resolution
      resolution = {
        explanation: responseText.substring(0, 300),
        suggestedChanges: {},
        priority: conflict.severity,
      };
    }

    return NextResponse.json({
      resolution,
      conflictId,
    });
  } catch (error) {
    console.error("Error resolving conflict:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to resolve conflict" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  // Apply authentication and rate limiting
  const { response } = await applyApiMiddleware(
    request,
    MIDDLEWARE_PRESETS.AI
  );
  if (response) return response;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { canvasId, suggestedChanges } = body;

    if (!canvasId || !suggestedChanges) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get canvas
    const canvas = await getCanvasById(canvasId);
    if (!canvas) {
      return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
    }

    // Apply changes
    const updatedCanvas = { ...canvas };
    Object.entries(suggestedChanges).forEach(([fieldKey, change]) => {
      const changeData = change as { suggestedValue: unknown };
      const field = updatedCanvas[fieldKey as keyof typeof updatedCanvas];
      if (field && typeof field === "object" && "value" in field) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (field as any).value = changeData.suggestedValue;
      }
    });

    updatedCanvas.updatedAt = new Date().toISOString();

    // Save to database (pass changedBy for audit trail)
    await saveCanvas(updatedCanvas, session.user.id);

    return NextResponse.json({ canvas: updatedCanvas });
  } catch (error) {
    console.error("Error applying conflict resolution:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to apply conflict resolution" },
      { status: 500 }
    );
  }
}
