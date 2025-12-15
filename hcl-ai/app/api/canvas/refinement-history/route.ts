import { NextRequest, NextResponse } from "next/server";
import { refinementHistoryRepository } from "@/services/database/refinement-history-repository";
import { getCanvasById } from "@/services/database/canvas-repository";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import { auth } from "@/lib/auth";
import { userRepository } from "@/services/database/user-repository";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Apply authentication and rate limiting
  const { response } = await applyApiMiddleware(
    request,
    MIDDLEWARE_PRESETS.AI
  );
  if (response) return response;

  try {
    const body = await request.json();
    const { canvasId, fieldKey, fieldLabel, beforeValue, afterValue, instruction, industry } = body;

    if (!canvasId || !fieldKey || !fieldLabel || beforeValue === undefined || afterValue === undefined || !instruction) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify canvas exists
    const canvas = await getCanvasById(canvasId);
    if (!canvas) {
      return NextResponse.json(
        { error: "Canvas not found" },
        { status: 404 }
      );
    }

    const user = await userRepository.getUserById(session.user.id);
    const isAdmin = user?.role === "admin";
    const hasAccess = isAdmin || await userRepository.canUserAccessCanvas(canvasId, session.user.id);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You don't have access to this canvas" },
        { status: 403 }
      );
    }

    // Save refinement to history
    const refinement = await refinementHistoryRepository.saveRefinement({
      canvasId,
      fieldKey,
      fieldLabel,
      beforeValue: JSON.stringify(beforeValue),
      afterValue: JSON.stringify(afterValue),
      instruction,
      industry,
    });

    return NextResponse.json({ refinement });
  } catch (error) {
    console.error("Error saving refinement history:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to save refinement history" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Require authentication
  const { response } = await applyApiMiddleware(
    request,
    MIDDLEWARE_PRESETS.AUTH
  );
  if (response) return response;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await userRepository.getUserById(session.user.id);
    const isAdmin = user?.role === "admin";

    const { searchParams } = new URL(request.url);
    const canvasId = searchParams.get("canvasId");
    const fieldKey = searchParams.get("fieldKey");
    const insights = searchParams.get("insights") === "true";

    // Enforce authorization rules
    if (insights || (!canvasId && !fieldKey)) {
      if (!isAdmin) {
        return NextResponse.json(
          { error: "Forbidden: Admin access required" },
          { status: 403 }
        );
      }
    }

    if (canvasId) {
      const hasAccess = isAdmin || await userRepository.canUserAccessCanvas(canvasId, session.user.id);
      if (!hasAccess) {
        return NextResponse.json(
          { error: "Forbidden: You don't have access to this canvas" },
          { status: 403 }
        );
      }

      // Get refinements for a specific canvas
      const refinements = await refinementHistoryRepository.getRefinementsByCanvas(canvasId);
      return NextResponse.json({ refinements });
    }

    if (fieldKey) {
      if (!isAdmin) {
        return NextResponse.json(
          { error: "Forbidden: Admin access required" },
          { status: 403 }
        );
      }
      // Get patterns for a specific field
      const patterns = await refinementHistoryRepository.getRefinementPatternsByField(fieldKey);
      return NextResponse.json({ patterns });
    }

    if (insights) {
      // Admin-only learning insights
      const learningInsights = await refinementHistoryRepository.getLearningInsights();
      return NextResponse.json(learningInsights);
    }

    // Admin-only overall stats (insights=false handled above)
    const stats = await refinementHistoryRepository.getRefinementStats();
    return NextResponse.json({ stats });
  } catch (error) {
    console.error("Error fetching refinement history:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch refinement history" },
      { status: 500 }
    );
  }
}
