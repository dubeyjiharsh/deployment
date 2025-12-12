import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { settingsRepository } from "@/services/database/settings-repository";
import { getCanvasById } from "@/services/database/canvas-repository";
import { userRepository } from "@/services/database/user-repository";

const analysisRequestSchema = z.object({
  canvasId: z.string(),
  research: z.any(), // We trust the research object structure
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = analysisRequestSchema.parse(body);

    const hasAccess = await userRepository.canUserAccessCanvas(validated.canvasId, session.user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden: You don't have access to this canvas" }, { status: 403 });
    }

    const canvas = await getCanvasById(validated.canvasId);
    if (!canvas) {
      return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
    }

    // Check for downstream artifacts
    // We can infer this from the canvas data or assume if status is advanced
    // But for now, we'll check if specific fields that feed into downstream are present
    // Realistically, we should check the stories/execution tables, but let's stick to the canvas object context for this pass
    // or fetch them if needed. For this MVP, we will flag "potential" impact.

    const settings = await settingsRepository.getSettings();
    const provider = settings?.llmProvider || "claude";
    let model;

    if (provider === "openai") {
      const apiKey = settings?.openaiApiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OpenAI API key not configured");
      const openai = createOpenAI({ apiKey });
      model = openai("gpt-4o");
    } else {
      const apiKey = settings?.claudeApiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("Claude API key not configured");
      const anthropic = createAnthropic({ apiKey });
      model = anthropic("claude-sonnet-4-20250514");
    }

    const prompt = `You are a strategic business analyst.
    
    **Current Business Canvas:**
    ${JSON.stringify(canvas, null, 2)}

    **New Research Findings:**
    ${JSON.stringify(validated.research, null, 2)}

    **Task:**
    Analyze the Research Findings and compare them to the Current Business Canvas.
    Identify specific fields in the canvas that should be updated to reflect the new intelligence.
    
    For each proposed change:
    1. Identify the field key (e.g., "problemStatement", "valueProposition").
    2. Provide the CURRENT value.
    3. Provide a PROPOSED new value that incorporates the research.
    4. Explain the REASONING for the change.

    **Output Format (JSON):**
    {
      "changes": [
        {
          "fieldKey": "string",
          "fieldName": "string",
          "currentValue": "string",
          "proposedValue": "string",
          "reasoning": "string"
        }
      ],
      "downstreamImpact": {
        "stories": boolean, // true if user stories might need update
        "execution": boolean, // true if execution plan might need update
        "explanation": "string" // why downstream artifacts are impacted
      }
    }

    Return ONLY valid JSON.
    `;

    const { text } = await generateText({
      model,
      system: "You are a strategic business analyst. Return valid JSON only.",
      prompt,
      temperature: 0.2,
    });

    // Parse JSON
    let jsonText = text.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }
    const result = JSON.parse(jsonText);

    return NextResponse.json(result);

  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json({ error: "Failed to analyze impact" }, { status: 500 });
  }
}
