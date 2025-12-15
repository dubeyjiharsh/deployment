/**
 * Canvas Context Validation API
 * Validates if user input has sufficient context before generating canvas
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canvasGenerationRequestSchema } from "@/lib/validators/canvas-schema";
import { analyzeContextSufficiency } from "@/services/llm/context-validator";
import { rateLimitAI } from "@/lib/rate-limit";
import { settingsRepository } from "@/services/database/settings-repository";

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
    const validatedRequest = canvasGenerationRequestSchema.parse(body);

    // Get company settings
    const settings = await settingsRepository.getSettings();

    // Get uploaded files content if specified
    const fileContents: { filename: string; content: string }[] = [];
    if (validatedRequest.uploadedFiles && validatedRequest.uploadedFiles.length > 0) {
      const documents = settings?.documents || [];

      for (const fileId of validatedRequest.uploadedFiles) {
        const document = documents.find((doc: { id: string; filename: string; content: string }) => doc.id === fileId);
        if (document) {
          fileContents.push({
            filename: document.filename,
            content: document.content,
          });
        }
      }
    }

    // Build company context
    const companyContext = {
      companyName: settings?.companyName,
      industry: settings?.industry,
      companyInfo: settings?.companyInfo,
    };

    // Analyze context sufficiency
    const analysis = await analyzeContextSufficiency(
      validatedRequest.problemStatement,
      validatedRequest.contextualInfo,
      fileContents.length > 0 ? fileContents : undefined,
      companyContext
    );

    // Return analysis
    if (!analysis.sufficient) {
      return NextResponse.json({
        needsMoreContext: true,
        confidence: analysis.confidence,
        missingContext: analysis.missingContext,
        questions: analysis.clarifyingQuestions,
      });
    }

    // Sufficient context - proceed with generation
    return NextResponse.json({
      needsMoreContext: false,
      confidence: analysis.confidence,
      message: "Sufficient context for canvas generation",
    });
  } catch (error) {
    console.error("Context validation error:", error);

    if (error instanceof Error && error.message.includes("validation")) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to validate context" },
      { status: 500 }
    );
  }
}
