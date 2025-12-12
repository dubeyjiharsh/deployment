import { NextRequest, NextResponse } from "next/server";
import { refineField } from "@/services/llm/llm-client";
import { getCanvasById } from "@/services/database/canvas-repository";
import { queryMcpServers } from "@/services/mcp/client";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import { userRepository } from "@/services/database/user-repository";

// Whitelist of allowed default canvas field keys
const ALLOWED_DEFAULT_FIELDS = [
  "title",
  "problemStatement",
  "solutionRecommendation",
  "keyFeatures",
  "budgetResources",
  "timelines",
  "risks",
  "dependencies",
  "objectives",
  "kpis",
  "urgency",
  "dataDependencies",
  "alignmentLongTerm",
  "okrs",
  "stakeholderMap",
  "successCriteria",
  "assumptions",
  "technicalArchitecture",
  "securityCompliance",
  "changeManagement",
  "roiAnalysis",
  "research",
  "benchmarks",
] as const;

/**
 * Validates if a field key is allowed (either a default field or a custom field)
 * Custom fields are stored in the canvas object and use the businessCanvasSchema's .passthrough()
 */
function isValidFieldKey(fieldKey: string, canvas: Record<string, unknown>): boolean {
  // Check if it's a default field
  if (ALLOWED_DEFAULT_FIELDS.includes(fieldKey as typeof ALLOWED_DEFAULT_FIELDS[number])) {
    return true;
  }

  // Check if it's a custom field that exists in the canvas
  // Custom fields are added dynamically and will exist in the canvas object
  if (fieldKey in canvas) {
    return true;
  }

  return false;
}

export async function POST(request: NextRequest) {
  // Apply authentication and rate limiting
  const { response, session } = await applyApiMiddleware(
    request,
    MIDDLEWARE_PRESETS.AI
  );
  if (response) return response;

  try {
    const body = await request.json();
    const { canvasId, fieldKey, instruction, currentValue } = body;

    if (!canvasId || !fieldKey || !instruction) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await userRepository.getUserById(session.user.id);
    const isAdmin = user?.role === "admin";
    const hasAccess =
      isAdmin || (await userRepository.canUserAccessCanvas(canvasId, session.user.id));

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You don't have access to this canvas" },
        { status: 403 }
      );
    }

    // Get the canvas for context
    const canvas = await getCanvasById(canvasId);
    if (!canvas) {
      return NextResponse.json(
        { error: "Canvas not found" },
        { status: 404 }
      );
    }

    // Validate field key against whitelist (default fields) or check if it exists in canvas (custom fields)
    if (!isValidFieldKey(fieldKey, canvas)) {
      return NextResponse.json(
        { error: "Invalid field key" },
        { status: 400 }
      );
    }

    // Query MCP servers for fresh data
    let mcpData: string | undefined;
    try {
      console.log("Querying MCP servers for refinement context...");
      mcpData = await queryMcpServers(
        `${instruction} for ${fieldKey}`,
        canvas.problemStatement.value || undefined
      );
      if (mcpData) {
        console.log(`Retrieved ${mcpData.length} characters of MCP data for refinement`);
      }
    } catch (mcpError) {
      console.error("Error querying MCP servers:", mcpError);
      // Continue without MCP data if it fails
    }

    // Call the LLM to refine the field with MCP data
    const result = await refineField(
      fieldKey,
      currentValue?.value || currentValue,
      instruction,
      canvas.problemStatement.value || undefined,
      mcpData
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error refining field:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to refine field";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
