import { NextRequest, NextResponse } from "next/server";
import { generateEpicsFromOKRs } from "@/services/llm/llm-client";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import { getCanvasById, saveCanvas } from "@/services/database/canvas-repository";
import { nanoid } from "nanoid";
import type { Story } from "@/stores/canvas-store";
import { userRepository } from "@/services/database/user-repository";

/**
 * POST /api/canvas/generate-epics
 * Generates epics from selected OKRs (Yale workflow step 1)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Apply authentication and rate limiting
  const { response, session } = await applyApiMiddleware(
    request,
    MIDDLEWARE_PRESETS.AI
  );
  if (response) return response;

  try {
    const body = await request.json();
    const { canvasId, selectedOKRIds, businessRequirement, persist } = body;
    const shouldPersist = persist !== false;

    if (!canvasId) {
      return NextResponse.json(
        { error: "Canvas ID is required" },
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

    // Support both OKR-based and business requirement-based generation
    let epics: Story[] = [];

    if (businessRequirement) {
      // Generate epics from business requirement (alternative to OKRs)
      console.log("🎯 Generating epics from business requirement:", businessRequirement.title);
      const { generateEpicsFromBusinessRequirement } = await import("@/services/llm/llm-client");
      epics = await generateEpicsFromBusinessRequirement(canvasId, businessRequirement);
    } else {
      // Traditional OKR-based generation
      if (!selectedOKRIds || !Array.isArray(selectedOKRIds) || selectedOKRIds.length === 0) {
        return NextResponse.json(
          { error: "At least one OKR must be selected, or provide a business requirement" },
          { status: 400 }
        );
      }
      console.log("🎯 Generating epics from OKRs:", selectedOKRIds);
      epics = await generateEpicsFromOKRs(canvasId, selectedOKRIds);
    }

    const sanitizedEpics = sanitizeStories(epics, ["epic"]);

    // Load canvas and update with new stories (unless explicitly disabled)
    const canvas = await getCanvasById(canvasId);
    if (canvas) {
      const canvasWithStories = canvas as typeof canvas & { stories?: Array<{ id: string }> };
      const currentStories = canvasWithStories.stories || [];

      // Ensure unique IDs by adding suffix if there are duplicates
      const epicIds = new Set(currentStories.map((s) => s.id));
      const epicsWithUniqueIds = sanitizedEpics.map(epic => {
        if (epicIds.has(epic.id)) {
          const uniqueId = `${epic.id}-${nanoid(12)}`;
          return { ...epic, id: uniqueId };
        }
        epicIds.add(epic.id);
        return epic;
      });

      if (shouldPersist) {
        const updatedCanvas = {
          ...canvas,
          stories: [...currentStories, ...epicsWithUniqueIds],
          updatedAt: new Date().toISOString(),
        };
        await saveCanvas(updatedCanvas);
      }

      return NextResponse.json({ epics: epicsWithUniqueIds });
    }

    return NextResponse.json({ epics: sanitizedEpics });
  } catch (error) {
    console.error("Error generating epics:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate epics" },
      { status: 500 }
    );
  }
}

/**
 * Validate and deduplicate generated stories before returning/saving
 */
function sanitizeStories(
  stories: unknown,
  allowedTypes: Array<Story["type"]>
): Story[] {
  if (!Array.isArray(stories)) return [];

  const seenIds = new Set<string>();

  return stories.flatMap((story, index) => {
    if (!story || typeof story !== "object") return [];
    const raw = story as Partial<Story>;

    const type = allowedTypes.includes(raw.type as Story["type"])
      ? (raw.type as Story["type"])
      : allowedTypes[0];

    const id =
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id.trim()
        : `${type}-${nanoid(12)}`;

    if (seenIds.has(id)) return [];
    seenIds.add(id);

    const title =
      typeof raw.title === "string" && raw.title.trim()
        ? raw.title.trim()
        : `${type === "epic" ? "Epic" : "Item"} ${index + 1}`;

    const description =
      typeof raw.description === "string" ? raw.description : "";

    return [
      {
        ...raw,
        id,
        type,
        title,
        description,
      } as Story,
    ];
  });
}
