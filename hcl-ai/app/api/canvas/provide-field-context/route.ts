/**
 * Provide Field Context API
 * Allows users to provide additional context for a specific canvas field
 * and regenerate just that field with higher confidence
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { rateLimitAI } from "@/lib/rate-limit";
import { getCanvasById } from "@/services/database/canvas-repository";
import { userRepository } from "@/services/database/user-repository";
import { refineField } from "@/services/llm/llm-client";

const provideFieldContextSchema = z.object({
  canvasId: z.string(),
  fieldKey: z.string(),
  context: z.string().min(1),
  currentField: z.any().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const rateLimitResponse = rateLimitAI(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Parse and validate request
    const body = await req.json();
    const { canvasId, fieldKey, context } =
      provideFieldContextSchema.parse(body);

    // Get current canvas
    const canvas = await getCanvasById(canvasId);
    if (!canvas) {
      return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
    }

    const user = await userRepository.getUserById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const isAdmin = user.role === "admin";
    const hasAccess =
      isAdmin || (await userRepository.canUserAccessCanvas(canvasId, session.user.id));

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You don't have access to this canvas" },
        { status: 403 }
      );
    }

    // Re-generate just this field with additional context
    const refinedField = await refineField(
      canvasId,
      fieldKey,
      canvas.problemStatement?.value || "",
      `Please regenerate this field with the following additional context: ${context}

IMPORTANT: Only provide a value if you can do so with confidence >= 0.7 based on this new information. If still insufficient, return the insufficient_context state.`
    );

    // Return just the value for preview (don't save yet - user must accept)
    return NextResponse.json({
      success: true,
      value: refinedField.value,
    });
  } catch (error) {
    console.error("Provide field context error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to update field" },
      { status: 500 }
    );
  }
}
