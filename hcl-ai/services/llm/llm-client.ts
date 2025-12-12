import type { ILlmProvider } from "./providers/types";
import type { LlmProvider } from "@/lib/validators/settings-schema";
import type { Benchmark } from "@/lib/validators/canvas-schema";
import { VercelAIProvider } from "./providers/vercel-ai-provider";
import { OpenAIProvider } from "./providers/openai-provider";
import { settingsRepository } from "@/services/database/settings-repository";

/**
 * Get the configured LLM provider instance
 */
async function getProviderInstance(): Promise<ILlmProvider> {
  const settings = await settingsRepository.getSettings();
  const provider = (settings?.llmProvider || "claude") as LlmProvider;

  switch (provider) {
    case "claude": {
      const apiKey = settings?.claudeApiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("Claude API key not configured. Please add it in settings or set ANTHROPIC_API_KEY environment variable.");
      }
      console.log("🤖 Using Vercel AI SDK with Claude");
      return new VercelAIProvider(apiKey);
    }

    case "openai": {
      const apiKey = settings?.openaiApiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OpenAI API key not configured. Please add it in settings or set OPENAI_API_KEY environment variable.");
      }
      console.log("🤖 Using Vercel AI SDK with OpenAI");
      return new OpenAIProvider(apiKey);
    }

    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

/**
 * Refine a canvas field using the configured LLM provider
 */
export async function refineField(
  fieldName: string,
  currentValue: unknown,
  userQuestion: string,
  context?: string,
  mcpData?: string
): Promise<{ value: unknown; evidence: unknown[]; confidence: number }> {
  const provider = await getProviderInstance();
  return provider.refineField(fieldName, currentValue, userQuestion, context, mcpData);
}

/**
 * Refine a canvas field and return just the value
 */
export async function refineCanvasField(
  fieldName: string,
  currentValue: unknown,
  instruction: string,
  problemContext: string
): Promise<unknown> {
  const result = await refineField(fieldName, currentValue, instruction, problemContext);
  return result.value;
}

/**
 * Stream canvas generation using the configured LLM provider
 */
export async function* streamCanvasGeneration(
  problemStatement: string,
  contextualInfo?: string,
  fieldConfiguration?: Array<{ id: string; name: string; instructions: string; enabled: boolean; fieldKey?: string; type?: string; valueType?: string; examples?: string; negativePrompt?: string; supportsDiagram?: boolean }>,
  uploadedFiles?: Array<{ filename: string; content: string }>,
  research?: import("@/lib/validators/canvas-schema").ResearchReport
): AsyncGenerator<string, void, unknown> {
  const provider = await getProviderInstance();
  yield* provider.streamCanvasGeneration(problemStatement, contextualInfo, fieldConfiguration, uploadedFiles, research);
}

/**
 * Generate a complete business canvas (non-streaming)
 */
export async function generateCanvas(
  problemStatement: string,
  contextualInfo?: string,
  fieldConfiguration?: Array<{ id: string; name: string; instructions: string; enabled: boolean; fieldKey?: string; type?: string; valueType?: string; examples?: string; negativePrompt?: string; supportsDiagram?: boolean }>,
  uploadedFiles?: Array<{ filename: string; content: string }>
): Promise<import("@/lib/validators/canvas-schema").BusinessCanvas> {
  const { businessCanvasSchema } = await import("@/lib/validators/canvas-schema");
  const { nanoid } = await import("nanoid");

  let fullText = "";
  for await (const chunk of streamCanvasGeneration(problemStatement, contextualInfo, fieldConfiguration, uploadedFiles)) {
    fullText += chunk;
  }

  const canvas = JSON.parse(fullText);

  // Add metadata if not present
  const now = new Date().toISOString();
  const completeCanvas = {
    id: canvas.id || nanoid(),
    ...canvas,
    createdAt: canvas.createdAt || now,
    updatedAt: canvas.updatedAt || now,
    status: canvas.status || "draft",
  };

  // Validate against schema
  return businessCanvasSchema.parse(completeCanvas);
}

/**
 * Check if a specific provider is available
 */
export async function isProviderAvailable(provider: LlmProvider): Promise<boolean> {
  try {
    const settings = await settingsRepository.getSettings();

    if (provider === "claude") {
      return !!(settings?.claudeApiKey || process.env.ANTHROPIC_API_KEY);
    }

    if (provider === "openai") {
      return !!(settings?.openaiApiKey || process.env.OPENAI_API_KEY);
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Get the currently configured provider
 */
export async function getCurrentProvider(): Promise<LlmProvider> {
  const settings = await settingsRepository.getSettings();
  return (settings?.llmProvider || "claude") as LlmProvider;
}

/**
 * Expand an existing canvas with additional fields
 */
export async function expandCanvas(
  existingCanvas: import("@/lib/validators/canvas-schema").BusinessCanvas,
  fieldsToExpand: string[]
): Promise<Partial<import("@/lib/validators/canvas-schema").BusinessCanvas>> {
  const provider = await getProviderInstance();
  return provider.expandCanvas(existingCanvas, fieldsToExpand);
}

/**
 * Generate user stories, epics, and dev stories from a canvas
 */
export async function generateStories(
  canvasId: string
): Promise<import("@/stores/canvas-store").Story[]> {
  const { getCanvasById } = await import("@/services/database/canvas-repository");
  const canvas = await getCanvasById(canvasId);

  if (!canvas) {
    throw new Error("Canvas not found");
  }

  const provider = await getProviderInstance();
  return provider.generateStories(canvas);
}

/**
 * Generate execution plan (sprints, OKRs, resources) from canvas and stories
 */
export async function generateExecutionPlan(
  canvasId: string,
  stories: import("@/stores/canvas-store").Story[]
): Promise<import("@/stores/canvas-store").ExecutionPlan> {
  const { getCanvasById } = await import("@/services/database/canvas-repository");
  const canvas = await getCanvasById(canvasId);

  if (!canvas) {
    throw new Error("Canvas not found");
  }

  const provider = await getProviderInstance();
  return provider.generateExecutionPlan(canvas, stories);
}

/**
 * Detect conflicts and contradictions in a canvas
 */
export async function detectConflicts(
  canvasId: string
): Promise<import("@/stores/canvas-store").Conflict[]> {
  const { getCanvasById } = await import("@/services/database/canvas-repository");
  const { nanoid } = await import("nanoid");
  const canvas = await getCanvasById(canvasId);

  if (!canvas) {
    throw new Error("Canvas not found");
  }

  const provider = await getProviderInstance();
  const detectedConflicts = await provider.detectConflicts(canvas);

  // Add canvasId, resolved status, and detectedAt timestamp
  return detectedConflicts.map((conflict) => ({
    ...conflict,
    id: conflict.id || nanoid(),
    canvasId,
    resolved: false,
    detectedAt: new Date().toISOString(),
  }));
}

/**
 * Generate industry benchmarks for a canvas
 */
export async function generateBenchmarks(
  canvasId: string,
  industry: string
): Promise<Benchmark[]> {
  const { getCanvasById } = await import("@/services/database/canvas-repository");
  const canvas = await getCanvasById(canvasId);

  if (!canvas) {
    throw new Error("Canvas not found");
  }

  const provider = await getProviderInstance();
  return provider.generateBenchmarks(canvas, industry);
}

/**
 * Generate epics from selected OKRs (Yale workflow step 1)
 */
export async function generateEpicsFromOKRs(
  canvasId: string,
  selectedOKRIds: string[]
): Promise<import("@/stores/canvas-store").Story[]> {
  const { getCanvasById } = await import("@/services/database/canvas-repository");
  const canvas = await getCanvasById(canvasId);

  if (!canvas) {
    throw new Error("Canvas not found");
  }

  if (!selectedOKRIds || selectedOKRIds.length === 0) {
    throw new Error("No OKRs selected");
  }

  const provider = await getProviderInstance();
  return provider.generateEpicsFromOKRs(canvas, selectedOKRIds);
}

/**
 * Generate epics from a business requirement (alternative to OKRs)
 */
export async function generateEpicsFromBusinessRequirement(
  canvasId: string,
  businessRequirement: { id: string; title: string; description: string; category: string }
): Promise<import("@/stores/canvas-store").Story[]> {
  const { getCanvasById } = await import("@/services/database/canvas-repository");
  const canvas = await getCanvasById(canvasId);

  if (!canvas) {
    throw new Error("Canvas not found");
  }

  const provider = await getProviderInstance();
  return provider.generateEpicsFromBusinessRequirement(canvas, businessRequirement);
}

/**
 * Generate features from selected epics (Yale workflow step 2)
 */
export async function generateFeaturesFromEpics(
  canvasId: string,
  epics: import("@/stores/canvas-store").Story[],
  selectedEpicIds: string[]
): Promise<import("@/stores/canvas-store").Story[]> {
  const { getCanvasById } = await import("@/services/database/canvas-repository");
  const canvas = await getCanvasById(canvasId);

  if (!canvas) {
    throw new Error("Canvas not found");
  }

  if (!selectedEpicIds || selectedEpicIds.length === 0) {
    throw new Error("No epics selected");
  }

  const provider = await getProviderInstance();
  return provider.generateFeaturesFromEpics(canvas, epics, selectedEpicIds);
}

/**
 * Generate user stories and dev stories from selected features (Yale workflow step 3)
 */
export async function generateUserStoriesFromFeatures(
  canvasId: string,
  features: import("@/stores/canvas-store").Story[],
  selectedFeatureIds: string[]
): Promise<import("@/stores/canvas-store").Story[]> {
  const { getCanvasById } = await import("@/services/database/canvas-repository");
  const canvas = await getCanvasById(canvasId);

  if (!canvas) {
    throw new Error("Canvas not found");
  }

  if (!selectedFeatureIds || selectedFeatureIds.length === 0) {
    throw new Error("No features selected");
  }

  const provider = await getProviderInstance();
  return provider.generateUserStoriesFromFeatures(canvas, features, selectedFeatureIds);
}
