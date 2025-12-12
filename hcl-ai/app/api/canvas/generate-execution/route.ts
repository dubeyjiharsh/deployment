import { NextRequest, NextResponse } from "next/server";
import { generateExecutionPlan } from "@/services/llm/llm-client";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import { userRepository } from "@/services/database/user-repository";

/**
 * POST /api/canvas/generate-execution
 * Generates execution plan (sprints, OKRs, resources) for a canvas based on stories
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Apply authentication and rate limiting
  const { response, session } = await applyApiMiddleware(
    request,
    MIDDLEWARE_PRESETS.AI
  );
  if (response) return response;

  try {
    const body = await request.json();
    const { canvasId, stories } = body;

    if (!canvasId) {
      return NextResponse.json(
        { error: "Canvas ID is required" },
        { status: 400 }
      );
    }

    if (!stories || !Array.isArray(stories)) {
      return NextResponse.json(
        { error: "Stories array is required" },
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

    // Generate execution plan using LLM
    const executionPlan = await generateExecutionPlan(canvasId, stories);

    return NextResponse.json({ executionPlan });
  } catch (error) {
    console.error("Error generating execution plan:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate execution plan" },
      { status: 500 }
    );
  }
}
