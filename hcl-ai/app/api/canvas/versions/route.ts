import { NextRequest, NextResponse } from "next/server";
import { getCanvasVersions } from "@/services/database/canvas-versions-repository";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import { auth } from "@/lib/auth";
import { userRepository } from "@/services/database/user-repository";

/**
 * GET /api/canvas/versions?canvasId=xxx
 * Get all versions for a canvas
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Apply authentication and rate limiting
  const { response } = await applyApiMiddleware(
    request,
    MIDDLEWARE_PRESETS.AUTH
  );
  if (response) return response;

  try {
    const { searchParams } = new URL(request.url);
    const canvasId = searchParams.get("canvasId");

    if (!canvasId) {
      return NextResponse.json(
        { error: "Canvas ID is required" },
        { status: 400 }
      );
    }

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

    const versions = await getCanvasVersions(canvasId);

    return NextResponse.json({ versions });
  } catch (error) {
    console.error("Error fetching canvas versions:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch canvas versions" },
      { status: 500 }
    );
  }
}
