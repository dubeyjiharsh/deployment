import { NextRequest, NextResponse } from "next/server";
import { getCanvasById, saveCanvas, deleteCanvas, canUserAccessCanvas, getCanvasOwnerId } from "@/services/database/canvas-repository";
import { businessCanvasSchema } from "@/lib/validators/canvas-schema";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import { auth } from "@/lib/auth";
import { userRepository } from "@/services/database/user-repository";
import { getUserCanvasPermission } from "@/services/database/user-repository";

/**
 * GET /api/canvas/[id]
 * Retrieves a canvas by ID (with permission check)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // Apply authentication and rate limiting
  const { response } = await applyApiMiddleware(
    request,
    MIDDLEWARE_PRESETS.AUTH
  );
  if (response) return response;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const canvas = await getCanvasById(id);

    if (!canvas) {
      return NextResponse.json(
        { error: "Canvas not found" },
        { status: 404 }
      );
    }

    // Check if user is admin or has access to this canvas
    const user = await userRepository.getUserById(session.user.id);
    const isAdmin = user?.role === "admin";
    const hasAccess = isAdmin || await canUserAccessCanvas(id, session.user.id);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You don't have access to this canvas" },
        { status: 403 }
      );
    }

    // Fetch ownership and sharing role for caller (for UI gating)
    const ownerId = await getCanvasOwnerId(id);
    const permission = await getUserCanvasPermission(id, session.user.id);
    const sharedRole = ownerId && session.user.id === ownerId
      ? "owner"
      : permission?.role || null;

    return NextResponse.json({
      ...canvas,
      ownerId: ownerId || null,
      sharedRole,
    });
  } catch (error) {
    console.error("Error fetching canvas:", error);
    return NextResponse.json(
      { error: "Failed to fetch canvas" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/canvas/[id]
 * Updates a canvas (with permission check)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if user is admin or has access to this canvas
    const user = await userRepository.getUserById(session.user.id);
    const isAdmin = user?.role === "admin";
    const hasAccess = isAdmin || await canUserAccessCanvas(id, session.user.id);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You don't have permission to update this canvas" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate canvas data
    const validatedCanvas = businessCanvasSchema.parse({
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    });

    // Save to database
    await saveCanvas(validatedCanvas, session.user.id);

    return NextResponse.json(validatedCanvas);
  } catch (error) {
    console.error("Error updating canvas:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update canvas" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/canvas/[id]
 * Deletes a canvas (with permission check)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if user is admin or has access to this canvas
    const user = await userRepository.getUserById(session.user.id);
    const isAdmin = user?.role === "admin";
    const hasAccess = isAdmin || await canUserAccessCanvas(id, session.user.id);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You don't have permission to delete this canvas" },
        { status: 403 }
      );
    }

    // deleteCanvas will handle cleanup of RAG document chunks
    await deleteCanvas(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting canvas:", error);
    return NextResponse.json(
      { error: "Failed to delete canvas" },
      { status: 500 }
    );
  }
}
