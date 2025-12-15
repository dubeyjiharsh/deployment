import { NextRequest, NextResponse } from "next/server";
import { mcpServerConfigSchema } from "@/lib/validators/canvas-schema";
import { testMcpConnection } from "@/services/mcp/client";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";

/**
 * POST /api/mcp/test
 * Test connection to an MCP server
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Apply authentication and rate limiting
  const { response } = await applyApiMiddleware(
    request,
    MIDDLEWARE_PRESETS.AUTH
  );
  if (response) return response;

  try {
    const body = await request.json();

    // Validate server config
    const server = mcpServerConfigSchema.parse({
      ...body,
      id: body.id || "test",
      createdAt: body.createdAt || new Date().toISOString(),
    });

    // Test connection
    const result = await testMcpConnection(server);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error testing MCP connection:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to test MCP connection" },
      { status: 500 }
    );
  }
}
