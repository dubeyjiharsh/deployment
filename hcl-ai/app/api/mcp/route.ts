import { NextRequest, NextResponse } from "next/server";
import { mcpServerConfigSchema } from "@/lib/validators/canvas-schema";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import {
  getAllMcpServers,
  saveMcpServer,
  deleteMcpServer,
  toggleMcpServer,
} from "@/services/database/mcp-repository";
import { nanoid } from "nanoid";

/**
 * GET /api/mcp
 * Get all MCP server configurations
 * SECURITY: Admin-only access
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  // Apply authentication and rate limiting (admin-only)
  const { response } = await applyApiMiddleware(
    req,
    MIDDLEWARE_PRESETS.ADMIN
  );
  if (response) return response;

  try {
    const servers = await getAllMcpServers();
    return NextResponse.json(servers);
  } catch (error) {
    console.error("Error fetching MCP servers:", error);
    return NextResponse.json(
      { error: "Failed to fetch MCP servers" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mcp
 * Create a new MCP server configuration
 * SECURITY: Admin-only access to prevent RCE attacks
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Apply authentication and rate limiting (admin-only)
  const { response } = await applyApiMiddleware(
    request,
    MIDDLEWARE_PRESETS.ADMIN
  );
  if (response) return response;

  try {
    const body = await request.json();

    const server = mcpServerConfigSchema.parse({
      ...body,
      id: nanoid(),
      createdAt: new Date().toISOString(),
    });

    await saveMcpServer(server);

    return NextResponse.json(server, { status: 201 });
  } catch (error) {
    console.error("Error creating MCP server:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to create MCP server" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/mcp
 * Toggle an MCP server's enabled status
 * SECURITY: Admin-only access
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  // Apply authentication and rate limiting (admin-only)
  const { response } = await applyApiMiddleware(
    request,
    MIDDLEWARE_PRESETS.ADMIN
  );
  if (response) return response;

  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Server ID is required" },
        { status: 400 }
      );
    }

    await toggleMcpServer(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error toggling MCP server:", error);
    return NextResponse.json(
      { error: "Failed to toggle MCP server" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/mcp
 * Delete an MCP server configuration
 * SECURITY: Admin-only access
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  // Apply authentication and rate limiting (admin-only)
  const { response } = await applyApiMiddleware(
    request,
    MIDDLEWARE_PRESETS.ADMIN
  );
  if (response) return response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Server ID is required" },
        { status: 400 }
      );
    }

    await deleteMcpServer(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting MCP server:", error);
    return NextResponse.json(
      { error: "Failed to delete MCP server" },
      { status: 500 }
    );
  }
}
