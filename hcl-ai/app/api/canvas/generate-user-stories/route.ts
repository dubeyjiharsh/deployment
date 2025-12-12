import { NextRequest, NextResponse } from "next/server";
import { generateUserStoriesFromFeatures } from "@/services/llm/llm-client";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import { getCanvasById, saveCanvas } from "@/services/database/canvas-repository";
import { nanoid } from "nanoid";
import type { Story } from "@/stores/canvas-store";
import { userRepository } from "@/services/database/user-repository";

/**
 * POST /api/canvas/generate-user-stories
 * Generates user stories and dev stories from selected features (Yale workflow step 3)
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
    const { canvasId, features, selectedFeatureIds, persist } = body;
    const shouldPersist = persist !== false;

    if (!canvasId) {
      return NextResponse.json(
        { error: "Canvas ID is required" },
        { status: 400 }
      );
    }

    if (!features || !Array.isArray(features)) {
      return NextResponse.json(
        { error: "Features array is required" },
        { status: 400 }
      );
    }

    if (!selectedFeatureIds || !Array.isArray(selectedFeatureIds) || selectedFeatureIds.length === 0) {
      return NextResponse.json(
        { error: "At least one feature must be selected" },
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

    // Generate user stories using LLM
    const stories = await generateUserStoriesFromFeatures(canvasId, features, selectedFeatureIds);
    const sanitizedStories = sanitizeStories(stories, ["user-story", "dev-story"]);

    // Load canvas and update with new stories (unless explicitly disabled)
    const canvas = await getCanvasById(canvasId);
    if (canvas) {
      const canvasWithStories = canvas as typeof canvas & { stories?: Array<{ id: string }> };
      const currentStories = canvasWithStories.stories || [];

      // Ensure unique IDs by adding timestamp suffix if there are duplicates
      const storyIds = new Set(currentStories.map((s) => s.id));
      const storiesWithUniqueIds = sanitizedStories.map(story => {
        if (storyIds.has(story.id)) {
          const uniqueId = `${story.id}-${nanoid(12)}`;
          return { ...story, id: uniqueId };
        }
        storyIds.add(story.id);
        return story;
      });

      if (shouldPersist) {
        const updatedCanvas = {
          ...canvas,
          stories: [...currentStories, ...storiesWithUniqueIds],
          updatedAt: new Date().toISOString(),
        };
        await saveCanvas(updatedCanvas);
      }

      return NextResponse.json({ stories: storiesWithUniqueIds });
    }

    return NextResponse.json({ stories: sanitizedStories });
  } catch (error) {
    console.error("Error generating user stories:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate user stories" },
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
        : `${type === "dev-story" ? "Dev Story" : "User Story"} ${index + 1}`;

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
