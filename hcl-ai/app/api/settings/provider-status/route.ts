import { NextRequest, NextResponse } from "next/server";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";

/**
 * GET /api/settings/provider-status
 * Check which LLM providers have API keys configured via environment variables
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { response } = await applyApiMiddleware(request, {
    ...MIDDLEWARE_PRESETS.AUTH,
    requireAdmin: true,
  });
  if (response) return response;

  try {
    const status = {
      claude: {
        hasEnvKey: !!process.env.ANTHROPIC_API_KEY,
        source: process.env.ANTHROPIC_API_KEY ? "environment" : "database",
      },
      openai: {
        hasEnvKey: !!process.env.OPENAI_API_KEY,
        source: process.env.OPENAI_API_KEY ? "environment" : "database",
      },
    };

    return NextResponse.json({ status });
  } catch (error) {
    console.error("Error checking provider status:", error);
    return NextResponse.json(
      { error: "Failed to check provider status" },
      { status: 500 }
    );
  }
}
