import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, streamText, wrapLanguageModel, type CoreMessage } from "ai";
import type { ILlmProvider } from "./types";
import type { BusinessCanvas, Benchmark } from "@/lib/validators/canvas-schema";
import { settingsRepository } from "@/services/database/settings-repository";
import {
  buildSystemPrompt,
  buildGenerationPrompt,
  buildRefinementPrompt,
  buildExpansionPrompt,
  buildStoriesPrompt,
  buildExecutionPrompt,
  buildConflictDetectionPrompt,
  buildBenchmarksPrompt,
} from "../prompts";
import {
  getMcpToolsForVercelAI,
  buildVercelAIToolSystemPrompt,
} from "@/services/mcp/vercel-ai-integration";
import { formatDocumentsForSystemPrompt } from "./vercel-ai-utils";
import { cacheMiddleware } from "../middleware/cache-middleware";

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const MAX_RETRIES = 3; // Retry failed requests up to 3 times
const CACHE_ENABLED = process.env.ENABLE_LLM_CACHE === 'true';

/**
 * Parse Anthropic API errors and return user-friendly messages
 */
function handleAnthropicError(error: unknown, operation: string): never {
  console.error(`Error in ${operation}:`, error);

  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('overload')) {
      throw new Error("Anthropic API is currently overloaded. Please try again in a few moments.");
    } else if (errorMessage.includes('rate limit')) {
      throw new Error("Rate limit exceeded. Please wait a moment and try again.");
    } else if (errorMessage.includes('api key')) {
      throw new Error("API key configuration issue. Please check your Claude API key in settings.");
    } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      throw new Error("Request timed out. Please try again.");
    } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      throw new Error("Network error. Please check your connection and try again.");
    }

    // Preserve the original error message
    throw new Error(`${operation} failed: ${error.message}`);
  }

  throw new Error(`${operation} failed with unknown error`);
}

/**
 * Vercel AI SDK provider implementation for Claude
 */
export class VercelAIProvider implements ILlmProvider {
  private anthropic: ReturnType<typeof createAnthropic>;

  constructor(apiKey: string) {
    this.anthropic = createAnthropic({ apiKey });
  }

  /**
   * Get the Anthropic model instance with optional caching
   */
  private getModel() {
    const baseModel = this.anthropic(CLAUDE_MODEL);

    // Apply caching middleware if enabled
    if (CACHE_ENABLED) {
      return wrapLanguageModel({
        model: baseModel,
        middleware: cacheMiddleware,
      });
    }

    return baseModel;
  }

  /**
   * Refine a specific field using Vercel AI SDK
   */
  async refineField(
    fieldName: string,
    currentValue: unknown,
    userQuestion: string,
    context?: string,
    mcpData?: string
  ): Promise<{ value: unknown; evidence: unknown[]; confidence: number }> {
    try {
      const settings = await settingsRepository.getSettings();
      const baseSystemPrompt = buildSystemPrompt(settings || undefined);

      // Build system prompt with documents if available
      let systemPrompt = baseSystemPrompt;

      // Add full documents to system prompt with caching
      if (settings?.documents && settings.documents.length > 0) {
        systemPrompt += "\n\n" + formatDocumentsForSystemPrompt(
          settings.documents,
          `## Reference Documents

The following documents contain authoritative information about the company.
Use these as primary sources when refining this field.`
        );
      }

      const userPrompt = buildRefinementPrompt(fieldName, currentValue, userQuestion, context, mcpData);

      const { text } = await generateText({
        model: this.getModel(),
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.3,
        maxOutputTokens: 4096,
        maxRetries: MAX_RETRIES,
      });

      const refinedField = this.parseJsonResponse<{
        value: unknown;
        evidence?: unknown[];
        confidence?: number;
      }>(text, "object", { value: currentValue, evidence: [], confidence: 0.5 });

      return {
        value: refinedField.value,
        evidence: refinedField.evidence || [],
        confidence: refinedField.confidence || 0,
      };
    } catch (error) {
      handleAnthropicError(error, "Field refinement");
    }
  }

  /**
   * Stream canvas generation (yields chunks)
   */
  async *streamCanvasGeneration(
    problemStatement: string,
    contextualInfo?: string,
    fieldConfiguration?: Array<{
      id: string;
      name: string;
      instructions: string;
      enabled: boolean;
      fieldKey?: string;
      type?: string;
      valueType?: string;
      examples?: string;
      negativePrompt?: string;
      supportsDiagram?: boolean;
    }>,
    uploadedFiles?: Array<{ filename: string; content: string }>,
    research?: import("@/lib/validators/canvas-schema").ResearchReport
  ): AsyncGenerator<string, void, unknown> {
    try {
      console.log("🤖 Using Vercel AI SDK for streaming generation");
      if (fieldConfiguration && fieldConfiguration.length > 0) {
        const enabledFields = fieldConfiguration.filter((f) => f.enabled);
        console.log(
          `📝 Including ${enabledFields.length} enabled fields (${fieldConfiguration.filter((f) => f.type === "custom").length} custom)`
        );
      }

      const settings = await settingsRepository.getSettings();
      const baseSystemPrompt = buildSystemPrompt(settings || undefined);

      const { tools } = await getMcpToolsForVercelAI();
      const toolPrompt = tools && Object.keys(tools).length > 0 ? buildVercelAIToolSystemPrompt() : "";

      // Build system prompt
      let systemPrompt = baseSystemPrompt;

      if (toolPrompt) {
        systemPrompt += "\n\n" + toolPrompt;
      }

      // Add uploaded files specific to this generation request
      if (uploadedFiles && uploadedFiles.length > 0) {
        systemPrompt += "\n\n" + formatDocumentsForSystemPrompt(
          uploadedFiles.map((f, idx) => ({
            id: `upload-${idx}`,
            filename: f.filename,
            content: f.content,
            uploadedAt: new Date().toISOString(),
          })),
          `## User-Uploaded Documents for This Canvas - HIGHEST PRIORITY

🔥 **ATTENTION**: These ${uploadedFiles.length} document(s) were specifically uploaded for THIS canvas generation:
${uploadedFiles.map((f) => `   - ${f.filename}`).join("\n")}

They contain the MOST RELEVANT and AUTHORITATIVE information for this specific problem.

**CRITICAL REQUIREMENTS:**
1. YOU MUST EXTRACT DATA FROM **ALL ${uploadedFiles.length} DOCUMENTS** - not just one!
2. Each document provides different perspectives and information
3. Cross-reference information across ALL documents to ensure completeness
4. When citing evidence, ENSURE you're using the correct filename from the list above
5. DO NOT cite only one document - distribute your citations across all ${uploadedFiles.length} files

**PRIORITY RULES:**
1. These documents have HIGHEST PRIORITY - they override general company docs
2. Extract EVERY relevant detail - requirements, constraints, stakeholders, timelines, budgets
3. Use EXACT numbers, dates, and names from these documents
4. Identify ANY mentioned technologies, tools, vendors, partners, or competitors
5. Note ALL stakeholder concerns, feedback, or requirements
6. Use confidence 0.95-1.0 for data from these files

**EVIDENCE FORMAT:**
When citing, use the ACTUAL filename where you found the information:
- {"snippet": "exact quote", "source": "upload:${uploadedFiles[0].filename}", "confidence": 0.95-1.0}
${uploadedFiles.length > 1 ? `- {"snippet": "exact quote", "source": "upload:${uploadedFiles[1].filename}", "confidence": 0.95-1.0}` : ""}
${uploadedFiles.length > 2 ? `- {"snippet": "exact quote", "source": "upload:${uploadedFiles[2].filename}", "confidence": 0.95-1.0}` : ""}
- DO NOT use generic names - use the EXACT filename from the document header above`
        );
        console.log(`📎 Added ${uploadedFiles.length} uploaded file(s) to system prompt`);
      }

      // Map field configuration
      const mappedFieldConfig = fieldConfiguration?.map((f) => ({
        id: f.id,
        name: f.name,
        fieldKey: f.fieldKey || f.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
        instructions: f.instructions,
        enabled: f.enabled,
        valueType: f.valueType,
        examples: f.examples,
        negativePrompt: f.negativePrompt,
        supportsDiagram: f.supportsDiagram,
        type: f.type,
      }));

      const userPrompt = buildGenerationPrompt(
        problemStatement,
        contextualInfo,
        mappedFieldConfig,
        undefined,
        uploadedFiles,
        research
      );

      const messages: CoreMessage[] = [
        {
          role: "user",
          content: userPrompt,
        },
      ];

      // Use streamText with automatic tool calling
      // Increased token limit to handle large canvas outputs with diagrams
      const result = streamText({
        model: this.getModel(),
        system: systemPrompt,
        messages,
        tools: tools && Object.keys(tools).length > 0 ? tools : undefined,
        temperature: 0.3,
        maxOutputTokens: 16384,
        maxRetries: MAX_RETRIES,
      });

      // Stream the final text response
      for await (const chunk of result.textStream) {
        yield chunk;
      }
    } catch (error) {
      handleAnthropicError(error, "Canvas generation streaming");
    }
  }

  /**
   * Expand existing canvas with additional fields
   */
  async expandCanvas(
    existingCanvas: BusinessCanvas,
    fieldsToExpand: string[]
  ): Promise<Partial<BusinessCanvas>> {
    try {
      console.log(`🔧 Expanding canvas with fields: ${fieldsToExpand.join(", ")}`);

      const settings = await settingsRepository.getSettings();
      const baseSystemPrompt = buildSystemPrompt(settings || undefined);

      const { tools } = await getMcpToolsForVercelAI();
      const toolPrompt = tools && Object.keys(tools).length > 0 ? buildVercelAIToolSystemPrompt() : "";

      // Build system prompt with documents
      let systemPrompt = baseSystemPrompt;

      if (toolPrompt) {
        systemPrompt += "\n\n" + toolPrompt;
      }

      // Add full documents to system prompt
      if (settings?.documents && settings.documents.length > 0) {
        systemPrompt += "\n\n" + formatDocumentsForSystemPrompt(
          settings.documents,
          `## Reference Documents

The following documents contain authoritative information about the company.
Use these documents as primary sources when expanding the canvas fields.`
        );
      }

      const userPrompt = buildExpansionPrompt(
        existingCanvas,
        fieldsToExpand,
        existingCanvas.problemStatement.value || ""
      );

      const { text } = await generateText({
        model: this.getModel(),
        system: systemPrompt,
        prompt: userPrompt,
        tools: tools && Object.keys(tools).length > 0 ? tools : undefined,
        temperature: 0.3,
        maxOutputTokens: 8192,
        maxRetries: MAX_RETRIES,
      });

      console.log("📝 Vercel AI SDK response for expansion:", text.substring(0, 200));

      const expandedFields = this.parseJsonResponse<Partial<BusinessCanvas>>(text, "object");

      console.log("✅ Canvas expansion complete");
      return expandedFields;
    } catch (error) {
      handleAnthropicError(error, "Canvas expansion");
    }
  }

  /**
   * Generate user stories, epics, and dev stories from a canvas
   */
  async generateStories(canvas: BusinessCanvas): Promise<import("@/stores/canvas-store").Story[]> {
    try {
      console.log("📝 Generating stories for canvas:", canvas.id);

      const userPrompt = buildStoriesPrompt(canvas);

      const { text } = await generateText({
        model: this.getModel(),
        system:
          "You are a senior product manager and agile expert. Generate comprehensive user stories based on business canvases.",
        prompt: userPrompt,
        temperature: 0.3,
        maxOutputTokens: 8192,
        maxRetries: MAX_RETRIES,
      });

      console.log("📝 Vercel AI SDK response for stories:", text.substring(0, 200));

      const stories = this.parseJsonResponse<import("@/stores/canvas-store").Story[]>(text, "array");

      console.log(`✅ Generated ${stories.length} stories`);
      return stories;
    } catch (error) {
      handleAnthropicError(error, "Story generation");
    }
  }

  /**
   * Generate execution plan (sprints, OKRs, resources) from canvas and stories
   */
  async generateExecutionPlan(
    canvas: BusinessCanvas,
    stories: import("@/stores/canvas-store").Story[]
  ): Promise<import("@/stores/canvas-store").ExecutionPlan> {
    try {
      console.log("📅 Generating execution plan for canvas:", canvas.id);

      const userPrompt = buildExecutionPrompt(canvas, stories);

      const { text } = await generateText({
        model: this.getModel(),
        system:
          "You are a senior project manager and agile coach. Generate comprehensive execution plans including sprints, OKRs, and resource allocation.",
        prompt: userPrompt,
        temperature: 0.3,
        maxOutputTokens: 8192,
        maxRetries: MAX_RETRIES,
      });

      console.log("📅 Vercel AI SDK response for execution plan:", text.substring(0, 200));

      const executionPlan = this.parseJsonResponse<import("@/stores/canvas-store").ExecutionPlan>(
        text,
        "object",
        { sprints: [], resources: [] }  // Fallback to empty plan instead of failing
      );

      console.log(
        `✅ Generated execution plan with ${executionPlan.sprints?.length || 0} sprints and ${executionPlan.resources?.length || 0} resources`
      );
      return executionPlan;
    } catch (error) {
      handleAnthropicError(error, "Execution plan generation");
    }
  }

  /**
   * Detect conflicts and contradictions in a canvas
   */
  async detectConflicts(
    canvas: BusinessCanvas
  ): Promise<
    Array<Omit<import("@/stores/canvas-store").Conflict, "canvasId" | "resolved" | "detectedAt">>
  > {
    try {
      console.log("🔍 Detecting conflicts for canvas:", canvas.id);

      const userPrompt = buildConflictDetectionPrompt(canvas);

      const { text } = await generateText({
        model: this.getModel(),
        system:
          "You are an expert business analyst reviewing business canvases for contradictions and conflicts that could impact project success.",
        prompt: userPrompt,
        temperature: 0.3,
        maxOutputTokens: 4096,
        maxRetries: MAX_RETRIES,
      });

      console.log("🔍 Vercel AI SDK response for conflicts:", text.substring(0, 200));

      type ConflictArray = Array<
        Omit<import("@/stores/canvas-store").Conflict, "canvasId" | "resolved" | "detectedAt">
      >;
      const conflicts = this.parseJsonResponse<ConflictArray>(text, "array", []);

      console.log(`✅ Detected ${conflicts.length} conflicts`);
      return conflicts;
    } catch (error) {
      handleAnthropicError(error, "Conflict detection");
    }
  }

  /**
   * Generate industry benchmarks for a canvas
   */
  async generateBenchmarks(
    canvas: BusinessCanvas,
    industry: string
  ): Promise<Benchmark[]> {
    try {
      console.log("📊 Generating benchmarks for canvas:", canvas.id, "Industry:", industry);

      const userPrompt = buildBenchmarksPrompt(canvas, industry);

      const { text } = await generateText({
        model: this.getModel(),
        system:
          "You are a senior business analyst with deep industry expertise. Compare business projects against industry standards and provide actionable insights.",
        prompt: userPrompt,
        temperature: 0.3,
        maxOutputTokens: 4096,
        maxRetries: MAX_RETRIES,
      });

      console.log("📊 Vercel AI SDK response for benchmarks:", text.substring(0, 200));

      const benchmarks = this.parseJsonResponse<Benchmark[]>(
        text,
        "array",
        []
      );

      console.log(`✅ Generated ${benchmarks.length} benchmarks`);
      return benchmarks;
    } catch (error) {
      handleAnthropicError(error, "Benchmark generation");
    }
  }

  /**
   * Generate epics from selected OKRs (Yale workflow step 1)
   */
  async generateEpicsFromOKRs(
    canvas: BusinessCanvas,
    selectedOKRIds: string[]
  ): Promise<import("@/stores/canvas-store").Story[]> {
    try {
      console.log("🎯 Generating epics from selected OKRs:", selectedOKRIds);

      const { buildEpicsFromOKRsPrompt } = await import("../prompts");
      const userPrompt = buildEpicsFromOKRsPrompt(canvas, selectedOKRIds);

      const { text } = await generateText({
        model: this.getModel(),
        system:
          "You are a senior product strategist and agile expert. Generate high-level Epics that directly map to OKRs with explicit lineage tracking for audit purposes.",
        prompt: userPrompt,
        temperature: 0.3,
        maxOutputTokens: 8192,
        maxRetries: MAX_RETRIES,
      });

      console.log("🎯 Vercel AI SDK response for epics:", text.substring(0, 200));

      const epics = this.parseJsonResponse<import("@/stores/canvas-store").Story[]>(text, "array", []);

      console.log(`✅ Generated ${epics.length} epics`);
      return epics;
    } catch (error) {
      handleAnthropicError(error, "Epic generation");
    }
  }

  /**
   * Generate epics from a business requirement (alternative to OKRs)
   */
  async generateEpicsFromBusinessRequirement(
    canvas: BusinessCanvas,
    businessRequirement: { id: string; title: string; description: string; category: string }
  ): Promise<import("@/stores/canvas-store").Story[]> {
    try {
      console.log("🎯 Generating epics from business requirement:", businessRequirement.title);

      const { buildEpicsFromBusinessRequirementPrompt } = await import("../prompts");
      const userPrompt = buildEpicsFromBusinessRequirementPrompt(canvas, businessRequirement);

      const { text } = await generateText({
        model: this.getModel(),
        system:
          "You are a senior product strategist and agile expert. Generate high-level Epics based on business requirements derived from canvas analysis.",
        prompt: userPrompt,
        temperature: 0.3,
        maxOutputTokens: 8192,
        maxRetries: MAX_RETRIES,
      });

      console.log("🎯 Vercel AI SDK response for epics from business requirement:", text.substring(0, 200));

      const epics = this.parseJsonResponse<import("@/stores/canvas-store").Story[]>(text, "array", []);

      console.log(`✅ Generated ${epics.length} epics from business requirement`);
      return epics;
    } catch (error) {
      handleAnthropicError(error, "Epic generation from business requirement");
    }
  }

  /**
   * Generate features from selected epics (Yale workflow step 2)
   */
  async generateFeaturesFromEpics(
    canvas: BusinessCanvas,
    epics: import("@/stores/canvas-store").Story[],
    selectedEpicIds: string[]
  ): Promise<import("@/stores/canvas-store").Story[]> {
    try {
      console.log("🎯 Generating features from selected epics:", selectedEpicIds);

      const { buildFeaturesFromEpicsPrompt } = await import("../prompts");
      const userPrompt = buildFeaturesFromEpicsPrompt(canvas, epics, selectedEpicIds);

      const { text } = await generateText({
        model: this.getModel(),
        system:
          "You are a senior product manager and feature architect. Generate mid-level Features that break down Epics into concrete, deliverable capabilities with lineage tracking.",
        prompt: userPrompt,
        temperature: 0.3,
        maxOutputTokens: 8192,
        maxRetries: MAX_RETRIES,
      });

      console.log("🎯 Vercel AI SDK response for features:", text.substring(0, 200));

      const features = this.parseJsonResponse<import("@/stores/canvas-store").Story[]>(
        text,
        "array",
        []
      );

      console.log(`✅ Generated ${features.length} features`);
      return features;
    } catch (error) {
      handleAnthropicError(error, "Feature generation");
    }
  }

  /**
   * Generate user stories and dev stories from selected features (Yale workflow step 3)
   */
  async generateUserStoriesFromFeatures(
    canvas: BusinessCanvas,
    features: import("@/stores/canvas-store").Story[],
    selectedFeatureIds: string[]
  ): Promise<import("@/stores/canvas-store").Story[]> {
    try {
      console.log("🎯 Generating user stories from selected features:", selectedFeatureIds);

      const { buildUserStoriesFromFeaturesPrompt } = await import("../prompts");
      const userPrompt = buildUserStoriesFromFeaturesPrompt(canvas, features, selectedFeatureIds);

      const { text } = await generateText({
        model: this.getModel(),
        system:
          "You are a senior product manager and agile expert. Generate detailed User Stories and Development Stories that implement Features, with complete lineage tracking for audit purposes.",
        prompt: userPrompt,
        temperature: 0.3,
        maxOutputTokens: 8192,
        maxRetries: MAX_RETRIES,
      });

      console.log("🎯 Vercel AI SDK response for user stories:", text.substring(0, 200));

      const stories = this.parseJsonResponse<import("@/stores/canvas-store").Story[]>(
        text,
        "array",
        []
      );

      console.log(`✅ Generated ${stories.length} stories`);
      return stories;
    } catch (error) {
      handleAnthropicError(error, "User story generation");
    }
  }

  /**
   * Parse JSON from response, handling markdown code blocks and conversational text
   */
  private parseJsonResponse<T>(
    textContent: string,
    expectedType: "object" | "array",
    fallbackValue?: T
  ): T {
    // Strip markdown code blocks if present
    let jsonText = textContent.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }

    // Try to extract JSON based on expected type
    const pattern = expectedType === "array" ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
    const jsonMatch = jsonText.match(pattern);

    if (jsonMatch) {
      jsonText = jsonMatch[0];
    } else if (fallbackValue !== undefined) {
      console.log(`⚠️ No JSON ${expectedType} found in response, using fallback value`);
      return fallbackValue;
    } else {
      throw new Error(`Response did not contain a valid JSON ${expectedType}`);
    }

    try {
      return JSON.parse(jsonText) as T;
    } catch (parseError) {
      console.error("❌ Failed to parse response:", parseError);
      console.error("Raw response:", textContent.substring(0, 500));
      console.error("Cleaned response:", jsonText.substring(0, 500));

      // Try to repair truncated JSON
      try {
        let repairedJson = jsonText;
        const openBrackets = (repairedJson.match(/\{/g) || []).length;
        const closeBrackets = (repairedJson.match(/\}/g) || []).length;
        const openSquare = (repairedJson.match(/\[/g) || []).length;
        const closeSquare = (repairedJson.match(/\]/g) || []).length;

        if (expectedType === "array" && !repairedJson.trim().endsWith("]")) {
          // For arrays, try to find the last complete object
          const lastCompleteObject = repairedJson.lastIndexOf("},");
          if (lastCompleteObject > 0) {
            repairedJson = repairedJson.substring(0, lastCompleteObject + 1);
          }
        } else if (expectedType === "object" && !repairedJson.trim().endsWith("}")) {
          // For objects, try to find the last complete array or value
          const lastCompleteArray = repairedJson.lastIndexOf("],");
          const lastCompleteValue = repairedJson.lastIndexOf('",');
          const lastComplete = Math.max(lastCompleteArray, lastCompleteValue);
          if (lastComplete > 0) {
            repairedJson = repairedJson.substring(0, lastComplete + 1);
          }
        }

        // Close any unclosed brackets/braces
        for (let i = 0; i < openSquare - closeSquare; i++) {
          repairedJson += "]";
        }
        for (let i = 0; i < openBrackets - closeBrackets; i++) {
          repairedJson += "}";
        }

        const parsed = JSON.parse(repairedJson);
        console.log("✅ Successfully repaired and parsed JSON!");
        return parsed as T;
      } catch (repairError) {
        console.error("❌ JSON repair failed:", repairError);
      }

      // If repair failed and we have a fallback, use it
      if (fallbackValue !== undefined) {
        console.log("⚠️ Using fallback value after JSON parse failure");
        return fallbackValue;
      }

      throw new Error(
        `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : "Unknown error"}`
      );
    }
  }
}
