import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createCollaborationToken } from "@/lib/collaboration-token";
import { userRepository } from "@/services/database/user-repository";

/**
 * POST /api/collaboration/token
 *
 * Generates a collaboration token for a specific canvas.
 * The client uses this token to connect to the Hocuspocus server.
 *
 * Expected request body:
 * - canvasId: string
 *
 * Returns: { token: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify the user is authenticated
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { canvasId } = body as { canvasId?: string };

    if (!canvasId) {
      return NextResponse.json(
        { error: "canvasId is required" },
        { status: 400 }
      );
    }

    // Verify user has access to this canvas
    const user = await userRepository.getUserById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const isAdmin = user.role === "admin";
    const hasAccess =
      isAdmin ||
      (await userRepository.canUserAccessCanvas(canvasId, session.user.id));

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied to this canvas" },
        { status: 403 }
      );
    }

    // Generate the collaboration token
    const token = await createCollaborationToken(
      session.user.id,
      session.user.name || "Anonymous",
      canvasId
    );

    return NextResponse.json({ token });
  } catch (error) {
    console.error("[Collaboration] Token generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}
