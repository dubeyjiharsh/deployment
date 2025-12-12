import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { settingsRepository } from "@/services/database/settings-repository";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import type { LlmProvider } from "@/lib/validators/settings-schema";

const requestSchema = z.object({
  currentInstructions: z.string().min(1, "Current instructions are required"),
  fieldName: z.string().min(1, "Field name is required"),
  valueType: z.enum(["string", "array", "object"]),
});

/**
 * POST /api/settings/improve-instructions
 * Uses AI to improve field generation instructions
 */
export async function POST(req: NextRequest) {
  // Apply authentication and rate limiting
  const { response } = await applyApiMiddleware(
    req,
    {
      ...MIDDLEWARE_PRESETS.AI,
      requireAdmin: true,
    }
  );
  if (response) return response;

  try {
    const body = await req.json();
    const { currentInstructions, fieldName, valueType } = requestSchema.parse(body);

    const settings = await settingsRepository.getSettings();
    const provider = (settings?.llmProvider || "claude") as LlmProvider;

    const prompt = `You are an expert at writing clear, effective prompts for AI systems.

A user has written instructions for an AI to generate content for a business canvas field called "${fieldName}".
The field's VALUE TYPE is configured as: "${valueType}" (this is handled separately by the system)

Current instructions:
"""
${currentInstructions}
"""

Your task: Improve these instructions to be more clear, specific, and effective. The improved instructions should:
1. Be concise but comprehensive
2. Focus on WHAT content to generate, not HOW to format it
3. Include relevant context and constraints
4. Guide the AI to produce high-quality, relevant output
5. Maintain the original intent while being more precise

CRITICAL RULES:
- Do NOT include any JSON formatting instructions (e.g., "return as JSON", "use this structure: {}")
- Do NOT specify output format like arrays, objects, or specific data structures
- Do NOT include example JSON schemas or templates
- The system automatically handles formatting based on the valueType setting ("${valueType}")
- Focus ONLY on the content, quality, and substance of what should be generated

Return ONLY the improved instructions, without any preamble or explanation.`;

    let improvedInstructions: string;

    if (provider === "claude") {
      const apiKey = settings?.claudeApiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("Claude API key not configured");
      }

      const { anthropic } = await import("@ai-sdk/anthropic");
      const { generateText } = await import("ai");

      const model = anthropic("claude-sonnet-4-20250514");

      const { text } = await generateText({
        model,
        prompt,
        temperature: 0.7,
        maxOutputTokens: 512,
      });

      improvedInstructions = text.trim();
    } else if (provider === "openai") {
      const apiKey = settings?.openaiApiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OpenAI API key not configured");
      }

      const { openai } = await import("@ai-sdk/openai");
      const { generateText } = await import("ai");

      const model = openai("gpt-4o-mini");

      const { text } = await generateText({
        model,
        prompt,
        temperature: 0.7,
        maxOutputTokens: 512,
      });

      improvedInstructions = text.trim();
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    if (!improvedInstructions) {
      throw new Error("Generated empty response");
    }

    return NextResponse.json({
      improvedInstructions,
    });
  } catch (error) {
    console.error("Error improving instructions:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to improve instructions" },
      { status: 500 }
    );
  }
}
