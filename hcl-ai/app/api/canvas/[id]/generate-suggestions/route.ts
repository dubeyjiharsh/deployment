import { NextRequest, NextResponse } from "next/server";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import { getCanvasById } from "@/services/database/canvas-repository";
import { generateEpicsFromOKRs } from "@/services/llm/llm-client";
import { nanoid } from "nanoid";
import type { Story } from "@/stores/canvas-store";

interface GenerationProgress {
  phase: "starting" | "epics" | "complete" | "error";
  message: string;
  suggestedEpics: Story[];
}

/**
 * POST /api/canvas/[id]/generate-suggestions
 * Generates AI suggestions for epics only (not features/stories to keep it fast)
 * This does NOT save to the canvas - items are suggested only
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { response } = await applyApiMiddleware(request, MIDDLEWARE_PRESETS.AI);
  if (response) return response;

  const { id: canvasId } = await params;

  try {
    const canvas = await getCanvasById(canvasId);
    if (!canvas) {
      return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
    }

    const result: GenerationProgress = {
      phase: "starting",
      message: "Starting suggestion generation...",
      suggestedEpics: [],
    };

    // Extract OKRs from canvas
    const okrsValue = canvas.okrs?.value;
    const okrs = (Array.isArray(okrsValue) ? okrsValue : [])
      .filter(
        (item): item is { id?: string; type: string; title: string; description: string } =>
          typeof item === "object" &&
          item !== null &&
          "type" in item &&
          "title" in item &&
          "description" in item
      )
      .filter((item) => item.type === "objective")
      .map((item, index) => ({
        ...item,
        id: item.id || `okr-${index}`,
      }));

    // Only generate epics if we have OKRs
    if (okrs.length === 0) {
      result.phase = "complete";
      result.message = "No OKRs found - skipping epic generation";
      return NextResponse.json(result);
    }

    // Generate epics from OKRs (limit to first 3 OKRs)
    result.phase = "epics";
    result.message = "Generating epic suggestions...";

    const allEpics: Story[] = [];

    for (const okr of okrs.slice(0, 3)) {
      try {
        const epics = await generateEpicsFromOKRs(canvasId, [okr.id]);
        // Add unique IDs and limit to 3 per OKR
        const epicsWithIds = epics.slice(0, 3).map((epic) => ({
          ...epic,
          id: `suggested-epic-${nanoid(12)}`,
          parentOKR: okr.id,
        }));
        allEpics.push(...epicsWithIds);
      } catch (error) {
        console.error(`Error generating epics for OKR ${okr.id}:`, error);
      }
    }

    result.suggestedEpics = allEpics;
    result.phase = "complete";
    result.message = "Suggestion generation complete!";

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in suggestion generation:", error);
    return NextResponse.json(
      {
        phase: "error",
        message: error instanceof Error ? error.message : "Failed to generate suggestions",
        suggestedEpics: [],
      },
      { status: 500 }
    );
  }
}
