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
    const teamId = searchParams.get("teamId");

    if (teamId) {
      const team = await userRepository.getTeamById(teamId);
      if (!team) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 });
      }

      // Get team members (only admins can see detailed member list)
      if (session.user.role === "admin") {
        const members = await userRepository.getUsersByTeam(teamId);
        return NextResponse.json({ team, members });
      }

      return NextResponse.json({ team });
    }

    // SECURITY: Filter teams by user access
    const allTeams = await userRepository.getAllTeams();

    // Admins can see all teams
    if (session.user.role === "admin") {
      return NextResponse.json({ teams: allTeams });
    }

    // Regular users can only see:
    // 1. Teams they own
    // 2. Teams they are a member of (their teamId matches)
    const accessibleTeams = allTeams.filter(
      team => team.ownerId === session.user.id || team.id === session.user.teamId
    );

    return NextResponse.json({ teams: accessibleTeams });
  } catch (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json(
      { error: "Failed to fetch teams" },
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

    // Only admins can create teams
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, ownerId, customFields } = body;

    if (!name || !ownerId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const team = await userRepository.createTeam(name, ownerId, customFields);

    return NextResponse.json({ team });
  } catch (error) {
    console.error("Error creating team:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to create team" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can update teams
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { teamId, name, customFields } = body;

    if (!teamId || !name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const team = await userRepository.updateTeam(teamId, name, customFields);

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    return NextResponse.json({ team });
  } catch (error) {
    console.error("Error updating team:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to update team" },
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

    // Only admins can delete teams
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");

    if (!teamId) {
      return NextResponse.json(
        { error: "Team ID is required" },
        { status: 400 }
      );
    }

    const deleted = await userRepository.deleteTeam(teamId);

    if (!deleted) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting team:", error);
    return NextResponse.json(
      { error: "Failed to delete team" },
      { status: 500 }
    );
  }
}
