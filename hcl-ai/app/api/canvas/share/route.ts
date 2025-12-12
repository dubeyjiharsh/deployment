import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userRepository } from "@/services/database/user-repository";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const canvasId = searchParams.get("canvasId");

    if (!canvasId) {
      return NextResponse.json(
        { error: "Canvas ID is required" },
        { status: 400 }
      );
    }

    // Check if user has access to this canvas
    const hasAccess = await userRepository.canUserAccessCanvas(
      canvasId,
      session.user.id
    );

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all permissions for this canvas
    const permissions = await userRepository.getCanvasPermissions(canvasId);

    // Get user details for each permission
    const permissionsWithUsers = await Promise.all(permissions.map(async (permission) => {
      const user = await userRepository.getUserById(permission.userId);
      return {
        ...permission,
        user: user
          ? {
              id: user.id,
              email: user.email,
              name: user.name,
            }
          : null,
      };
    }));

    return NextResponse.json({ permissions: permissionsWithUsers });
  } catch (error) {
    console.error("Error fetching canvas permissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch canvas permissions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { canvasId, userId, role } = body;

    if (!canvasId || !userId || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if current user is owner or admin
    const isOwner = await userRepository.canUserAccessCanvas(
      canvasId,
      session.user.id,
      "owner"
    );

    if (!isOwner && session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Only canvas owners can share canvases" },
        { status: 403 }
      );
    }

    // Validate role
    if (!["owner", "editor", "viewer"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Grant permission
    const permission = await userRepository.grantCanvasPermission(
      canvasId,
      userId,
      role
    );

    // Get user details
    const user = await userRepository.getUserById(userId);

    return NextResponse.json({
      permission: {
        ...permission,
        user: user
          ? {
              id: user.id,
              email: user.email,
              name: user.name,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Error sharing canvas:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to share canvas" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const canvasId = searchParams.get("canvasId");
    const userId = searchParams.get("userId");

    if (!canvasId || !userId) {
      return NextResponse.json(
        { error: "Canvas ID and User ID are required" },
        { status: 400 }
      );
    }

    // Check if current user is owner or admin
    const isOwner = await userRepository.canUserAccessCanvas(
      canvasId,
      session.user.id,
      "owner"
    );

    if (!isOwner && session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Only canvas owners can revoke permissions" },
        { status: 403 }
      );
    }

    const revoked = await userRepository.revokeCanvasPermission(canvasId, userId);

    if (!revoked) {
      return NextResponse.json(
        { error: "Permission not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking canvas permission:", error);
    return NextResponse.json(
      { error: "Failed to revoke canvas permission" },
      { status: 500 }
    );
  }
}
