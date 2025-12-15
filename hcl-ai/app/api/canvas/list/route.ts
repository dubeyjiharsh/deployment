import { NextRequest, NextResponse } from "next/server";
import { getAllCanvasesWithOwner, getCanvasesByUserWithOwner } from "@/services/database/canvas-repository";
import { auth } from "@/lib/auth";
import { rateLimitAPI } from "@/lib/rate-limit";
import { userRepository } from "@/services/database/user-repository";

/**
 * GET /api/canvas/list
 * Retrieves canvases accessible to the current user
 * Admins see all canvases, regular users only see their own or shared canvases
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting
    const rateLimitResponse = rateLimitAPI(req);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = await userRepository.getUserById(session.user.id);
    const isAdmin = user?.role === "admin";

    // Admins can see all canvases, users only see their own or shared
    // Include owner information for display
    const canvases = isAdmin
      ? await getAllCanvasesWithOwner(session.user.id)
      : await getCanvasesByUserWithOwner(session.user.id);

    return NextResponse.json(canvases);
  } catch (error) {
    console.error("Error fetching canvases:", error);
    return NextResponse.json(
      { error: "Failed to fetch canvases" },
      { status: 500 }
    );
  }
}
