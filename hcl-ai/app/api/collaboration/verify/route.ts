import { NextRequest, NextResponse } from "next/server";
import { verifyCollaborationToken } from "@/lib/collaboration-token";
import { userRepository } from "@/services/database/user-repository";

/**
 * POST /api/collaboration/verify
 *
 * Verifies a collaboration token sent by the Hocuspocus server.
 * Called by Hocuspocus during the onAuthenticate hook.
 *
 * Expected request:
 * - Authorization header: "Bearer <token>"
 * - Body: { documentName: string }
 *
 * Returns user info if valid, 401 if invalid.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix

    // Parse the request body
    const body = await request.json().catch(() => ({}));
    const { documentName } = body as { documentName?: string };

    // Verify the token
    const payload = await verifyCollaborationToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Extract canvas ID from document name (format: "canvas-{canvasId}")
    const canvasIdFromDoc = documentName?.replace(/^canvas-/, "");

    // Verify the token was issued for this specific canvas
    if (canvasIdFromDoc && payload.canvasId !== canvasIdFromDoc) {
      console.warn(
        `[Collaboration] Token canvas mismatch: token=${payload.canvasId}, document=${canvasIdFromDoc}`
      );
      return NextResponse.json(
        { error: "Token not valid for this document" },
        { status: 403 }
      );
    }

    // Verify user still has access to this canvas
    const user = await userRepository.getUserById(payload.userId);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 401 }
      );
    }

    const isAdmin = user.role === "admin";
    const hasAccess =
      isAdmin ||
      (await userRepository.canUserAccessCanvas(payload.canvasId, payload.userId));

    if (!hasAccess) {
      console.warn(
        `[Collaboration] User ${payload.userId} no longer has access to canvas ${payload.canvasId}`
      );
      return NextResponse.json(
        { error: "Access denied to this canvas" },
        { status: 403 }
      );
    }

    // Return user info for Hocuspocus context
    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error("[Collaboration] Verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
