import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getIndustryDisplayName, type Industry, type LlmProvider } from "@/lib/validators/settings-schema";
import { settingsRepository } from "@/services/database/settings-repository";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";

const requestSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  industry: z.string().min(1, "Industry is required"),
});

/**
 * POST /api/settings/generate-company-info
 * Generates company information using AI based on company name and industry
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
    const { companyName, industry } = requestSchema.parse(body);

    const settings = await settingsRepository.getSettings();
    const provider = (settings?.llmProvider || "claude") as LlmProvider;

    const industryName = getIndustryDisplayName(industry as Industry);

    const prompt = `Provide a concise company profile (3-4 paragraphs) for ${companyName}, a company in the ${industryName} industry.

Include:
- Core business model and primary products/services
- Market position and key competitors (if well-known)
- Notable strengths, unique value propositions, or competitive advantages
- Recent strategic initiatives or transformations (if publicly known)

Keep it factual and based on publicly available information. If ${companyName} is not a well-known company, provide a general profile based on typical companies in the ${industryName} industry.

Do not include speculative information. Focus on established facts or industry-standard characteristics.`;

    let companyInfo: string;

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
        maxOutputTokens: 1024,
      });

      companyInfo = text.trim();
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
        maxOutputTokens: 1024,
      });

      companyInfo = text.trim();
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    if (!companyInfo) {
      throw new Error("Generated empty response");
    }

    return NextResponse.json({
      companyInfo,
    });
  } catch (error) {
    console.error("Error generating company info:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate company information" },
      { status: 500 }
    );
  }
}
