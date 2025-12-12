import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { expandCanvas } from "@/services/llm/llm-client";
import { getCanvasById, saveCanvas } from "@/services/database/canvas-repository";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import { auth } from "@/lib/auth";

const expandRequestSchema = z.object({
  canvasId: z.string(),
  fields: z.array(z.string()).min(1, "At least one field must be selected"),
});

/**
 * POST /api/canvas/expand
 * Expands an existing canvas with additional fields
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Apply authentication and rate limiting
  const { response } = await applyApiMiddleware(
    request,
    MIDDLEWARE_PRESETS.AI
  );
  if (response) return response;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate request
    const { canvasId, fields } = expandRequestSchema.parse(body);

    // Get existing canvas
    const existingCanvas = await getCanvasById(canvasId);
    if (!existingCanvas) {
      return NextResponse.json(
        { error: "Canvas not found" },
        { status: 404 }
      );
    }

    // Expand canvas with additional fields
    const expandedFields = await expandCanvas(existingCanvas, fields);

    // Merge expanded fields into existing canvas
    const updatedCanvas = {
      ...existingCanvas,
      ...expandedFields,
      updatedAt: new Date().toISOString(),
    };

    // Save updated canvas (pass changedBy for audit trail)
    await saveCanvas(updatedCanvas, session.user.id);

    return NextResponse.json(updatedCanvas);
  } catch (error) {
    console.error("Error expanding canvas:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to expand canvas" },
      { status: 500 }
    );
  }
}
