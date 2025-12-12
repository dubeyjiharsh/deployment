import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userRepository } from "@/services/database/user-repository";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can list all users
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");

    const users = teamId
      ? await userRepository.getUsersByTeam(teamId)
      : await userRepository.getAllUsers();

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
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

    // Only admins can create users
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { email, name, password, role, teamId } = body;

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await userRepository.getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    const user = await userRepository.createUser({
      email,
      name,
      password,
      role,
      teamId,
    });

    // Remove password hash from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...userWithoutPassword } = user;

    return NextResponse.json({ user: userWithoutPassword });
  } catch (error) {
    console.error("Error creating user:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to create user" },
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

    const body = await request.json();
    const { userId, name, email, teamId, password, role } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Users can only update themselves unless they're admin
    if (session.user.id !== userId && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // SECURITY: Password changes via this endpoint are not allowed
    // Users must use /api/auth/change-password which requires old password verification
    if (password) {
      return NextResponse.json(
        { error: "Password changes must be done through the change password form" },
        { status: 400 }
      );
    }

    // SECURITY: Only admins can change team assignments or roles
    if ((teamId !== undefined || role !== undefined) && session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Only administrators can change team assignments or roles" },
        { status: 403 }
      );
    }

    // Update other fields
    const updates: { name?: string; email?: string; teamId?: string | null; role?: string } = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (teamId !== undefined) updates.teamId = teamId;
    if (role !== undefined) updates.role = role;

    const user = await userRepository.updateUser(userId, updates);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Remove password hash from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...userWithoutPassword } = user;

    return NextResponse.json({ user: userWithoutPassword });
  } catch (error) {
    console.error("Error updating user:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to update user" },
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

    // Only admins can delete users
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Don't allow deleting yourself
    if (session.user.id === userId) {
      return NextResponse.json(
        { error: "Cannot delete yourself" },
        { status: 400 }
      );
    }

    const deleted = await userRepository.deleteUser(userId);

    if (!deleted) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
