import type { BusinessCanvas, ResearchReport } from "@/lib/validators/canvas-schema";
import type { Story } from "@/stores/canvas-store";
import type { LlmProvider } from "@/lib/validators/settings-schema";

/**
 * Configuration for LLM providers
 */
export interface LlmProviderConfig {
  provider: LlmProvider;
  claudeApiKey?: string;
  openaiApiKey?: string;
}

/**
 * MCP tool definition in generic format
 */
export interface GenericMcpTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * MCP tool call result
 */
export interface ToolCallResult {
  toolName: string;
  result: string;
  source: string;
}

/**
 * Abstract interface for LLM providers
 */
export interface ILlmProvider {
  /**
   * Refine a specific field based on user input
   */
  refineField(
    fieldName: string,
    currentValue: unknown,
    userQuestion: string,
    context?: string,
    mcpData?: string
  ): Promise<{ value: unknown; evidence: unknown[]; confidence: number }>;

  /**
   * Stream canvas generation (chunked or token-level)
   */
  streamCanvasGeneration(
    problemStatement: string,
    contextualInfo?: string,
    fieldConfiguration?: Array<{ id: string; name: string; instructions: string; enabled: boolean; fieldKey?: string; type?: string; valueType?: string; examples?: string; negativePrompt?: string; supportsDiagram?: boolean }>,
    uploadedFiles?: Array<{ filename: string; content: string }>,
    research?: ResearchReport
  ): AsyncGenerator<string, void, unknown>;

  /**
   * Expand existing canvas with additional fields
   */
  expandCanvas(
    existingCanvas: BusinessCanvas,
    fieldsToExpand: string[]
  ): Promise<Partial<BusinessCanvas>>;

  /**
   * Generate user stories, epics, and dev stories from a canvas
   */
  generateStories(
    canvas: BusinessCanvas
  ): Promise<Story[]>;

  /**
   * Generate execution plan (sprints, OKRs, resources) from canvas and stories
   */
  generateExecutionPlan(
    canvas: BusinessCanvas,
    stories: Story[]
  ): Promise<import("@/stores/canvas-store").ExecutionPlan>;

  /**
   * Detect conflicts and contradictions in a canvas
   */
  detectConflicts(
    canvas: BusinessCanvas
  ): Promise<Array<Omit<import("@/stores/canvas-store").Conflict, "canvasId" | "resolved" | "detectedAt">>>;

  /**
   * Generate industry benchmarks for a canvas
   */
  generateBenchmarks(
    canvas: BusinessCanvas,
    industry: string
  ): Promise<import("@/lib/validators/canvas-schema").Benchmark[]>;

  /**
   * Generate epics from selected OKRs (Yale workflow step 1)
   */
  generateEpicsFromOKRs(
    canvas: BusinessCanvas,
    selectedOKRIds: string[]
  ): Promise<Story[]>;

  /**
   * Generate epics from a business requirement (alternative to OKRs)
   */
  generateEpicsFromBusinessRequirement(
    canvas: BusinessCanvas,
    businessRequirement: { id: string; title: string; description: string; category: string }
  ): Promise<Story[]>;

  /**
   * Generate features from selected epics (Yale workflow step 2)
   */
  generateFeaturesFromEpics(
    canvas: BusinessCanvas,
    epics: Story[],
    selectedEpicIds: string[]
  ): Promise<Story[]>;

  /**
   * Generate user stories and dev stories from selected features (Yale workflow step 3)
   */
  generateUserStoriesFromFeatures(
    canvas: BusinessCanvas,
    features: Story[],
    selectedFeatureIds: string[]
  ): Promise<Story[]>;
}

/**
 * Provider factory configuration
 */
export interface ProviderFactoryConfig {
  provider: LlmProvider;
  config: LlmProviderConfig;
}
