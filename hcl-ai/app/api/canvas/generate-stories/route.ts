import { NextRequest, NextResponse } from "next/server";
import { generateStories } from "@/services/llm/llm-client";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import { auth } from "@/lib/auth";
import { userRepository } from "@/services/database/user-repository";

/**
 * POST /api/canvas/generate-stories
 * Generates user stories, epics, and dev stories for a canvas
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Apply authentication and rate limiting
  const { response } = await applyApiMiddleware(
    request,
    MIDDLEWARE_PRESETS.AI
  );
  if (response) return response;

  try {
    const body = await request.json();
    const { canvasId } = body;

    if (!canvasId) {
      return NextResponse.json(
        { error: "Canvas ID is required" },
        { status: 400 }
      );
    }

    // Authorization: only owners/shared users (or admins) can generate stories
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await userRepository.getUserById(session.user.id);
    const isAdmin = user?.role === "admin";
    const hasAccess = isAdmin || await userRepository.canUserAccessCanvas(canvasId, session.user.id);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You don't have access to this canvas" },
        { status: 403 }
      );
    }

    // Generate stories using LLM
    const stories = await generateStories(canvasId);

    return NextResponse.json({ stories });
  } catch (error) {
    console.error("Error generating stories:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate stories" },
      { status: 500 }
    );
  }
}
