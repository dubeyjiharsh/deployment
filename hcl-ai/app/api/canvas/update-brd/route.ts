import { NextRequest, NextResponse } from "next/server";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import { auth } from "@/lib/auth";
import { getCanvasById, saveCanvas } from "@/services/database/canvas-repository";
import { z } from "zod";
import type { BusinessCanvas } from "@/lib/validators/canvas-schema";
import type { BRDDocument, BRDMetadata } from "@/lib/validators/brd-schema";
import { calculateBRDCompleteness } from "@/lib/validators/brd-schema";
import { userRepository } from "@/services/database/user-repository";

// Extended canvas type with BRD
type ExtendedCanvas = BusinessCanvas & {
  brd?: BRDDocument;
};

const requestSchema = z.object({
  canvasId: z.string(),
  deleteBrd: z.boolean().optional(),
  metadata: z
    .object({
      brdOwner: z.string().optional(),
      programName: z.string().optional(),
      portfolioEpic: z.string().optional(),
      brdApprover: z.string().optional(),
      approvalDate: z.string().optional(),
      version: z.string().optional(),
      signOffApprovers: z
        .array(
          z.object({
            role: z.string(),
            name: z.string().optional(),
            function: z.string().optional(),
          })
        )
        .optional(),
      reviewers: z
        .array(
          z.object({
            role: z.string(),
            name: z.string().optional(),
            function: z.string().optional(),
          })
        )
        .optional(),
      glossaryTerms: z
        .array(
          z.object({
            term: z.string(),
            definition: z.string(),
          })
        )
        .optional(),
      relatedDocuments: z
        .array(
          z.object({
            name: z.string(),
            url: z.string().optional(),
          })
        )
        .optional(),
    })
    .optional(),
  sections: z.record(z.string(), z.string()).optional(),
});

/**
 * POST /api/canvas/update-brd
 * Updates BRD metadata or sections
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log("🚀 Starting BRD Update");

  // Apply authentication and rate limiting
  const { response } = await applyApiMiddleware(request, MIDDLEWARE_PRESETS.AUTH);
  if (response) {
    console.log("⛔ Middleware blocked request");
    return response;
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = requestSchema.parse(body);

    console.log("🎯 Update BRD - Canvas ID:", validated.canvasId);

    const user = await userRepository.getUserById(session.user.id);
    const isAdmin = user?.role === "admin";
    const hasAccess =
      isAdmin || (await userRepository.canUserAccessCanvas(validated.canvasId, session.user.id));

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You don't have access to this canvas" },
        { status: 403 }
      );
    }

    // Load canvas
    const canvas = (await getCanvasById(validated.canvasId)) as ExtendedCanvas | null;
    if (!canvas) {
      console.error("❌ Canvas not found:", validated.canvasId);
      return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
    }

    // Handle delete BRD request
    if (validated.deleteBrd) {
      const now = new Date().toISOString();
      const updatedCanvas: ExtendedCanvas = {
        ...canvas,
        brd: undefined,
        updatedAt: now,
      };
      await saveCanvas(updatedCanvas, session.user.id, "Deleted BRD");
      console.log("✅ BRD deleted successfully");
      return NextResponse.json({ success: true });
    }

    if (!canvas.brd) {
      return NextResponse.json(
        { error: "No BRD exists for this canvas. Generate one first." },
        { status: 400 }
      );
    }

    console.log("✅ Canvas and BRD loaded successfully");

    const now = new Date().toISOString();

    // Update metadata if provided
    let updatedMetadata: BRDMetadata = canvas.brd.metadata;
    if (validated.metadata) {
      updatedMetadata = {
        ...canvas.brd.metadata,
        ...validated.metadata,
        // Preserve required fields
        brdOwner: validated.metadata.brdOwner || canvas.brd.metadata.brdOwner,
        programName: validated.metadata.programName || canvas.brd.metadata.programName,
      };
    }

    // Update sections if provided
    const updatedBrd: BRDDocument = {
      ...canvas.brd,
      metadata: updatedMetadata,
      updatedAt: now,
    };

    if (validated.sections) {
      // Handle section updates
      for (const [sectionKey, content] of Object.entries(validated.sections)) {
        if (sectionKey === "executiveSummary") {
          updatedBrd.executiveSummary = {
            ...updatedBrd.executiveSummary,
            content,
            isEdited: true,
          };
        }
        // Add more section handlers as needed
      }
    }

    // Recalculate completeness
    const completeness = calculateBRDCompleteness(updatedMetadata);
    updatedBrd.completeness = completeness;

    // Save updated canvas
    const updatedCanvas: ExtendedCanvas = {
      ...canvas,
      brd: updatedBrd,
      updatedAt: now,
    };

    await saveCanvas(updatedCanvas, session.user.id, "Updated BRD metadata");

    console.log("✅ BRD updated successfully");

    return NextResponse.json({ brd: updatedBrd });
  } catch (error) {
    console.error("❌ Error updating BRD:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to update BRD" }, { status: 500 });
  }
}
