import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userRepository } from "@/services/database/user-repository";

/**
 * GET /api/canvas/share-users
 * Returns a minimal list of users for sharing purposes.
 * Any authenticated user can access this to share canvases they own.
 * Only returns id, name, and email - no sensitive information.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");

    const users = teamId
      ? await userRepository.getUsersByTeam(teamId)
      : await userRepository.getAllUsers();

    // Return only minimal user info needed for sharing
    // Excludes sensitive fields like role, mustChangePassword, etc.
    const minimalUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      teamId: user.teamId,
    }));

    return NextResponse.json({ users: minimalUsers });
  } catch (error) {
    console.error("Error fetching users for sharing:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
