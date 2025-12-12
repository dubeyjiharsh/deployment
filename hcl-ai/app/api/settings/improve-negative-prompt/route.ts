import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { settingsRepository } from "@/services/database/settings-repository";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import type { LlmProvider } from "@/lib/validators/settings-schema";

const requestSchema = z.object({
  currentNegativePrompt: z.string().min(1, "Current negative prompt is required"),
  fieldName: z.string().min(1, "Field name is required"),
  instructions: z.string().optional(),
});

/**
 * POST /api/settings/improve-negative-prompt
 * Uses AI to improve negative prompt (constraints/what to avoid)
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
    const { currentNegativePrompt, fieldName, instructions } = requestSchema.parse(body);

    const settings = await settingsRepository.getSettings();
    const provider = (settings?.llmProvider || "claude") as LlmProvider;

    const contextInfo = instructions
      ? `\n\nContext - The field's generation instructions are:\n"""${instructions}"""`
      : "";

    const prompt = `You are an expert at writing effective constraints and negative prompts for AI systems.

A user has written a negative prompt (what to avoid) for an AI-generated field called "${fieldName}".

Current negative prompt:
"""
${currentNegativePrompt}
"""${contextInfo}

Your task: Improve this negative prompt to be more specific and effective. The improved prompt should:
1. Be clear and unambiguous about what to avoid
2. Provide specific examples of undesirable CONTENT (not format)
3. Guide the AI away from common content quality pitfalls
4. Be concise but comprehensive
5. Maintain the original intent while being more precise

CRITICAL RULES:
- Focus on CONTENT to avoid, not FORMAT to avoid
- Do NOT include constraints about JSON structure, arrays, objects, or data formats
- Do NOT mention "return as", "output format", or structural requirements
- The system handles formatting separately - focus only on content quality issues
- Examples should be about bad content (vague language, wrong tone, missing info) not bad structure

Return ONLY the improved negative prompt, without any preamble or explanation.`;

    let improvedNegativePrompt: string;

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

      improvedNegativePrompt = text.trim();
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

      improvedNegativePrompt = text.trim();
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    if (!improvedNegativePrompt) {
      throw new Error("Generated empty response");
    }

    return NextResponse.json({
      improvedNegativePrompt,
    });
  } catch (error) {
    console.error("Error improving negative prompt:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to improve negative prompt" },
      { status: 500 }
    );
  }
}
