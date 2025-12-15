import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { settingsRepository } from "@/services/database/settings-repository";
import { TavilyClient } from "tavily";
import { querySimilarChunks } from "@/services/rag/embedding-service";
import { userRepository } from "@/services/database/user-repository";
import { researchReportSchema } from "@/lib/validators/canvas-schema";

const researchRequestSchema = z.object({
  canvasId: z.string().optional(),
  problemStatement: z.string(),
  industry: z.string().optional(),
  objectives: z.string().optional(),
  targetMarket: z.string().optional(),
  uploadedFiles: z.array(z.string()).optional(),
});

interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

/**
 * Performs web search using Tavily
 */
async function searchWeb(query: string, maxResults: number = 5): Promise<SearchResult[]> {
  const tavilyApiKey = process.env.TAVILY_API_KEY;

  if (!tavilyApiKey) {
    console.warn("⚠️  Tavily API key not configured, skipping web search");
    return [];
  }

  try {
    const client = new TavilyClient({ apiKey: tavilyApiKey });

    const response = await client.search({
      query,
      search_depth: "advanced",
      max_results: maxResults,
      include_answer: false,
      include_raw_content: false,
    });

    return response.results.map((result) => ({
      title: result.title,
      url: result.url,
      content: result.content,
      score: parseFloat(result.score),
    }));
  } catch (error) {
    console.error("Tavily search error:", error);
    return [];
  }
}

/**
 * POST /api/canvas/research
 * Generates comprehensive research report using web search and AI analysis
 */
export async function POST(req: NextRequest) {
  try {
    // Authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request
    const body = await req.json();
    const validated = researchRequestSchema.parse(body);

    // Authorization: only owners/shared users (or admins) can run research for a canvas
    const user = await userRepository.getUserById(session.user.id);
    const isAdmin = user?.role === "admin";
    const hasAccess = isAdmin || !validated.canvasId
      ? true
      : await userRepository.canUserAccessCanvas(validated.canvasId, session.user.id);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You don't have access to this canvas" },
        { status: 403 }
      );
    }

    // Get LLM settings
    const settings = await settingsRepository.getSettings();
    const provider = settings?.llmProvider || "claude";
    
    let model;

    if (provider === "openai") {
      const apiKey = settings?.openaiApiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "OpenAI API key not configured" },
          { status: 500 }
        );
      }
      const openai = createOpenAI({ apiKey });
      model = openai("gpt-4o");
    } else {
      // Default to Claude
      const apiKey = settings?.claudeApiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "Claude API key not configured" },
          { status: 500 }
        );
      }
      const anthropic = createAnthropic({ apiKey });
      model = anthropic("claude-sonnet-4-20250514");
    }

    console.log(`🔍 [RESEARCH] Starting research using ${provider.toUpperCase()}`);

    // Perform targeted web searches
    const industry = validated.industry || "technology";

    // Extract key terms from problem statement for better searches
    const problemKeywords = validated.problemStatement
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 4)
      .slice(0, 5)
      .join(' ');

    const searches = [
      {
        name: "competitor_case_studies",
        query: `${industry} leaders ${problemKeywords} case studies implementation approach how they solved 2024 2025`,
      },
      {
        name: "competitor_strategies",
        query: `Nike H&M Zara ${industry} ${problemKeywords} strategy trends best practices 2024`,
      },
      {
        name: "industry_trends",
        query: `${industry} ${problemKeywords} emerging trends competitive landscape analysis 2024`,
      },
      {
        name: "benchmarks",
        query: `${industry} ${problemKeywords} ROI benchmarks industry metrics performance 2024`,
      },
      {
        name: "market_leaders_approach",
        query: `top ${industry} companies ${problemKeywords} tactics methods success metrics 2024`,
      },
    ];

    console.log("🌐 [RESEARCH] Performing web searches and retrieving internal context...");

    // Run web search and RAG in parallel
    const [searchResults, ragResult] = await Promise.all([
      Promise.all(
        searches.map(async ({ name, query }) => {
          console.log(`  - Searching: ${name}`);
          const results = await searchWeb(query, 5);
          console.log(`  ✓ Found ${results.length} results for ${name}`);
          return { name, results };
        })
      ),
      querySimilarChunks(validated.problemStatement, {
        canvasId: validated.canvasId ?? undefined,
        documentIds: validated.uploadedFiles && validated.uploadedFiles.length > 0 ? validated.uploadedFiles : undefined,
        limit: 10, // Get top 10 most relevant chunks
        similarityThreshold: 0.5,
      }).catch(err => {
        console.error("⚠️ [RESEARCH] RAG retrieval failed:", err);
        return { chunks: [], totalChunks: 0 };
      })
    ]);

    // Compile search context
    const searchContext = searchResults
      .map(({ name, results }) => {
        if (results.length === 0) return "";

        return `\n### ${name.toUpperCase()} SEARCH RESULTS:\n${results
          .map(
            (r, idx) =>
              `[${idx + 1}] ${r.title}\nURL: ${r.url}\nContent: ${r.content.substring(0, 500)}...\n`
          )
          .join("\n")}`;
      })
      .join("\n");

    // Compile internal knowledge context
    const internalContext = ragResult.chunks.length > 0
      ? ragResult.chunks
          .map((chunk, idx) => {
            const metadata = chunk.metadata as { filename?: string };
            const source = metadata.filename || "Internal Document";
            return `[${idx + 1}] SOURCE: ${source}\nCONTENT: ${chunk.content}\n`;
          })
          .join("\n")
      : "No relevant internal documents found.";

    console.log(`📚 [RESEARCH] Retrieved ${ragResult.chunks.length} internal document chunks`);
    console.log("🤖 [RESEARCH] Generating analysis with Claude...");

    // Create research prompt with real search results and internal context
    const researchPrompt = `You are a competitive intelligence and market research expert. Generate a comprehensive research report based on the following business context, INTERNAL KNOWLEDGE BASE (uploaded documents), and REAL web search results.

**BUSINESS CONTEXT:**
- Problem Statement: ${validated.problemStatement}
- Industry: ${validated.industry || "Not specified"}
- Objectives: ${validated.objectives || "Not specified"}

**INTERNAL KNOWLEDGE BASE (Context from User Documents):**
${internalContext}

**REAL SEARCH RESULTS FROM THE WEB:**
${searchContext}

**CRITICAL INSTRUCTIONS:**
1. **Synthesize information** from both the INTERNAL KNOWLEDGE BASE and REAL SEARCH RESULTS.
2. **Prioritize external data** for competitor analysis and industry benchmarks.
3. **Prioritize internal data** for specific problem details and internal context.
4. **ALWAYS cite sources**:
   - For web results: Use actual URLs.
   - For internal docs: Cite the filename (e.g., "Source: strategic-goals.pdf").
5. **DO NOT make up companies, numbers, or statistics.**
6. **Highlight alignment/gaps**: explicitly mention if internal goals align with or differ from industry trends found in search results.

**YOUR TASK:**
Generate a research report with these sections:

1. **Competitor Analysis & Industry Approaches**: Find 3-5 real competitors and HOW they addressed similar challenges:
   - PRIORITY: Focus on COMPETITOR STRATEGIES, not technology vendors/service providers.
   - Extract: Company name, their APPROACH to solving the problem, specific initiatives, outcomes.
   - Example: "Nike enhanced their PDP pages by implementing AR try-on features, resulting in 30% increase in engagement."
   - Format: ## [Company Name] - [What they did and why it worked]
   - Include specific numbers (revenue, growth %, engagement metrics, conversion improvements).
   - MANDATORY: Source URL for each competitor mentioned.
   - **AVOID**: Lists of third-party service providers or platforms unless discussing how competitors used them.

2. **Industry Trends & Emerging Practices**:
   - What are the latest trends in the industry for solving this type of challenge?
   - How are market leaders innovating in this space?
   - What approaches are becoming standard vs. cutting-edge?
   - Compare with any internal systems mentioned in "INTERNAL KNOWLEDGE BASE".
   - Source: Search results and internal context.

3. **Industry Benchmarks**: From benchmark search results:
   - Specific metrics found in search results.
   - Compare these with any internal metrics found in "INTERNAL KNOWLEDGE BASE".
   - Typical ROI/timeline data.
   - Source URLs.

4. **Estimated Financial Impact**: Conservative estimates based on:
   - Data found in search results.
   - Internal budget/revenue data if available in "INTERNAL KNOWLEDGE BASE".
   - Mark estimates as "estimated based on industry data" or "based on internal projection".

5. **Strategic Implications**:
   - How can the organization leverage these findings?
   - Specific opportunities for innovation or competitive advantage.
   - Long-term strategic alignment.

6. **Actionable Recommendations**: Based on insights from research:
   - Specific actions tied to findings.
   - Expected outcomes (conservative).
   - Source-backed insights.

**OUTPUT FORMAT (JSON):**
{
  "competitorAnalysis": {
    "title": "Competitive Intelligence & Industry Approaches",
    "content": "markdown with ## headers for each competitor, focus on THEIR STRATEGIES and RESULTS, not service providers",
    "sources": [{"title": "Article title or Filename", "url": "URL or 'Internal Document'"}]
  },
  "internalApplications": {
    "title": "Industry Trends & Emerging Practices",
    "content": "markdown formatted, focus on HOW the industry is solving similar challenges",
    "sources": [{"title": "...", "url": "..."}]
  },
  "industryBenchmarks": {
    "title": "Industry Benchmarks",
    "content": "markdown with specific numbers from sources",
    "sources": [{"title": "...", "url": "..."}]
  },
  "estimatedImpact": {
    "title": "Estimated Value Impact",
    "content": "markdown table with conservative estimates",
    "sources": [{"title": "...", "url": "..."}]
  },
  "strategicImplications": {
    "title": "Strategic Implications",
    "content": "markdown formatted with specific opportunities",
    "sources": [{"title": "...", "url": "..."}]
  },
  "recommendations": {
    "title": "Strategic Recommendations",
    "content": "markdown formatted with specific actions",
    "sources": [{"title": "...", "url": "..."}]
  }
}

**QUALITY CHECKS:**
- Every factual claim must have a source.
- Every source URL must be from the search results provided.
- If referencing internal docs, state "According to internal document...".
- Use markdown tables for structured data.
- Keep content focused on the problem statement.

    Generate the research report now as valid JSON:`;

    // Model is already instantiated based on provider settings above

    const { text } = await generateText({
      model,
      system: "You are a research analyst. Return ONLY valid JSON. Every factual claim must cite a source from the provided search results or internal documents. Do not hallucinate companies or statistics.",
      prompt: researchPrompt,
      temperature: 0.3, // Lower temperature for more factual output
      maxOutputTokens: 8000,
      maxRetries: 3,
    });
    // Parse response
    let jsonText = text.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const research = researchReportSchema.parse(JSON.parse(jsonText));

    console.log("✅ [RESEARCH] Research report generated successfully");

    // Save research to canvas
    try {
      if (validated.canvasId) {
        const { getCanvasById, saveCanvas } = await import("@/services/database/canvas-repository");

        const existingCanvas = await getCanvasById(validated.canvasId);

        if (existingCanvas) {
          const updatedCanvas = {
            ...existingCanvas,
            research: {
              ...research,
              generatedAt: new Date().toISOString(),
            },
            updatedAt: new Date().toISOString(),
          };

          await saveCanvas(updatedCanvas, session.user.id, "Generated research report");
          console.log("💾 [RESEARCH] Research saved to canvas");
        } else {
          console.warn("⚠️  [RESEARCH] Canvas not found:", validated.canvasId);
        }
      }
    } catch (saveError) {
      console.error("⚠️  [RESEARCH] Failed to save research to canvas:", saveError);
      // Don't fail the request if save fails
    }

    return NextResponse.json({ research });
  } catch (error) {
    console.error("❌ [RESEARCH] Research generation error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to generate research",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
