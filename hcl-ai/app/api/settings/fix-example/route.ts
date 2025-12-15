import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { settingsRepository } from "@/services/database/settings-repository";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import type { LlmProvider } from "@/lib/validators/settings-schema";

const requestSchema = z.object({
  currentExample: z.string().min(1, "Current example is required"),
  valueType: z.enum(["string", "array", "object"]),
  fieldName: z.string().min(1, "Field name is required"),
});

/**
 * POST /api/settings/fix-example
 * Uses AI to fix the format of an example value to match the expected type
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
    const { currentExample, valueType, fieldName } = requestSchema.parse(body);

    const settings = await settingsRepository.getSettings();
    const provider = (settings?.llmProvider || "claude") as LlmProvider;

    const typeExamples: Record<string, string> = {
      string: '"Example text value"',
      array: '["Item 1", "Item 2", "Item 3"]',
      object: '{"key": "value", "count": 5}',
    };

    const prompt = `You are an expert at JSON formatting and data structures.

A user has provided an example value for a field called "${fieldName}".
The expected type is: ${valueType}

Current example (which may be incorrectly formatted):
"""
${currentExample}
"""

Correct format for ${valueType}:
${typeExamples[valueType]}

Your task: Fix the formatting to match the expected type. Rules:
- For STRING: Return a properly quoted JSON string
- For ARRAY: Return a valid JSON array with properly formatted elements
- For OBJECT: Return a valid JSON object with proper key-value pairs
- Preserve the user's content/intent as much as possible
- Ensure valid JSON syntax
- Do NOT include markdown code blocks or explanations

Return ONLY the corrected example in proper JSON format.`;

    let fixedExample: string;

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
        temperature: 0.3, // Lower temperature for more precise formatting
        maxOutputTokens: 512,
      });

      fixedExample = text.trim();
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
        temperature: 0.3, // Lower temperature for more precise formatting
        maxOutputTokens: 512,
      });

      fixedExample = text.trim();
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    // Remove any markdown code blocks if present
    fixedExample = fixedExample.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    if (!fixedExample) {
      throw new Error("Generated empty response");
    }

    // Validate that the fixed example is valid JSON
    try {
      JSON.parse(fixedExample);
    } catch {
      console.error("AI generated invalid JSON:", fixedExample);
      // Fallback to the original if AI response is invalid
      fixedExample = currentExample;
    }

    return NextResponse.json({
      fixedExample,
    });
  } catch (error) {
    console.error("Error fixing example:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fix example format" },
      { status: 500 }
    );
  }
}
