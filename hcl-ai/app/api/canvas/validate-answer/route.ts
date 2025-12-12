/**
 * Answer Validation API
 * Validates user answers during conversational context gathering
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { validateAnswer } from "@/services/llm/answer-validator";

const validateAnswerSchema = z.object({
  question: z.string(),
  answer: z.string(),
  fieldName: z.string(),
  allQuestions: z
    .array(
      z.object({
        question: z.string(),
        field: z.string(),
      })
    )
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request
    const body = await req.json();
    const { question, answer, fieldName, allQuestions } =
      validateAnswerSchema.parse(body);

    // Validate the answer
    const validation = await validateAnswer(
      question,
      answer,
      fieldName,
      allQuestions
    );

    return NextResponse.json(validation);
  } catch (error) {
    console.error("Answer validation error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to validate answer" },
      { status: 500 }
    );
  }
}
