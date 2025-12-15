import { NextRequest, NextResponse } from "next/server";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import { getCanvasById } from "@/services/database/canvas-repository";
import { nanoid } from "nanoid";
import { userRepository } from "@/services/database/user-repository";

/**
 * POST /api/canvas/generate-business-requirements
 * Generates business requirements/ideas from canvas data (alternative to OKRs)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Apply authentication and rate limiting
  const { response, session } = await applyApiMiddleware(
    request,
    MIDDLEWARE_PRESETS.AI
  );
  if (response) {
    return response;
  }

  try {
    const body = await request.json();
    const { canvasId } = body;

    if (!canvasId) {
      return NextResponse.json(
        { error: "Canvas ID is required" },
        { status: 400 }
      );
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await userRepository.getUserById(session.user.id);
    const isAdmin = user?.role === "admin";
    const hasAccess =
      isAdmin || (await userRepository.canUserAccessCanvas(canvasId, session.user.id));

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You don't have access to this canvas" },
        { status: 403 }
      );
    }

    // Load canvas
    const canvas = await getCanvasById(canvasId);
    if (!canvas) {
      return NextResponse.json(
        { error: "Canvas not found" },
        { status: 404 }
      );
    }

    // Build context from canvas fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = canvas as any;
    const contextParts: string[] = [];

    if (c.problem?.value) {
      contextParts.push(`Problem Statement: ${c.problem.value}`);
    }
    if (c.solution?.value) {
      contextParts.push(`Proposed Solution: ${c.solution.value}`);
    }
    if (c.context?.value) {
      contextParts.push(`Context: ${c.context.value}`);
    }
    if (c.targetAudience?.value) {
      contextParts.push(`Target Audience: ${c.targetAudience.value}`);
    }
    if (c.valueProposition?.value) {
      contextParts.push(`Value Proposition: ${c.valueProposition.value}`);
    }
    if (c.risks?.value) {
      contextParts.push(`Risks: ${c.risks.value}`);
    }
    if (c.competitiveAnalysis?.value) {
      contextParts.push(`Competitive Analysis: ${c.competitiveAnalysis.value}`);
    }

    const canvasContext = contextParts.join("\n\n");

    if (!canvasContext) {
      return NextResponse.json(
        {
          error: "Canvas has insufficient data to generate business requirements. Please add at least a problem statement or solution description to your canvas first."
        },
        { status: 400 }
      );
    }

    // Generate business requirements using LLM
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    const { generateText } = await import("ai");
    const { settingsRepository } = await import("@/services/database/settings-repository");

    const settings = await settingsRepository.getSettings();
    const apiKey = settings?.claudeApiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("Claude API key not configured");
    }

    const anthropic = createAnthropic({ apiKey });
    const prompt = `Based on the following business canvas information, generate 5-8 high-level business requirements or capability areas that would be needed to address this business need. These will be used to generate epics and features.

${canvasContext}

For each requirement, provide:
1. A clear, concise title (5-10 words)
2. A brief description (1-2 sentences) explaining what this capability would deliver
3. A category (one of: "Core Functionality", "User Experience", "Infrastructure", "Integration", "Analytics", "Security & Compliance", "Operations")

Format your response as a JSON array with this structure:
[
  {
    "title": "Requirement title",
    "description": "Brief description of the requirement",
    "category": "Core Functionality"
  }
]

Focus on requirements that:
- Directly address the problem statement
- Enable the proposed solution
- Deliver value to the target audience
- Are feasible and implementable
- Cover different aspects of the solution (not all the same category)`;

    const { text: response } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt,
      temperature: 0.7,
      maxOutputTokens: 2048,
    });

    // Parse the JSON response
    let requirements: Array<{ title: string; description: string; category: string }> = [];

    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        requirements = JSON.parse(jsonMatch[0]);
      } else {
        requirements = JSON.parse(response);
      }
    } catch {
      console.error("Failed to parse LLM response:", response);
      throw new Error("Failed to parse business requirements from LLM response");
    }

    // Add IDs to requirements
    const requirementsWithIds = requirements.map((req) => ({
      ...req,
      id: nanoid(),
    }));

    console.log(`✅ Generated ${requirementsWithIds.length} business requirements`);

    return NextResponse.json({ requirements: requirementsWithIds });
  } catch (error) {
    console.error("❌ Error generating business requirements:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate business requirements" },
      { status: 500 }
    );
  }
}
