import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userRepository } from "@/services/database/user-repository";

/**
 * Share a canvas with an entire team
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { canvasId, teamId, role } = body;

    if (!canvasId || !teamId || !role) {
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

    // Get all users in the team
    const teamUsers = await userRepository.getUsersByTeam(teamId);

    if (teamUsers.length === 0) {
      return NextResponse.json(
        { error: "Team not found or has no members" },
        { status: 404 }
      );
    }

    // Grant permission to each user in the team
    const permissions = await Promise.all(teamUsers.map((user) => {
      return userRepository.grantCanvasPermission(canvasId, user.id, role);
    }));

    return NextResponse.json({
      success: true,
      permissionsGranted: permissions.length,
      team: await userRepository.getTeamById(teamId),
    });
  } catch (error) {
    console.error("Error sharing canvas with team:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to share canvas with team" },
      { status: 500 }
    );
  }
}
