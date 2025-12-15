import { z } from "zod";

/**
 * Evidence item that links back to a source
 */
export const evidenceItemSchema = z.object({
  snippet: z.string(),
  source: z.string(),
  confidence: z.number().min(0).max(1),
  location: z.string().optional().nullable(),
});

export type EvidenceItem = z.infer<typeof evidenceItemSchema>;

/**
 * Field structure with value, evidence, confidence, and optional diagram
 * Now supports insufficient context state
 */
export const fieldSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({
    value: valueSchema.nullable(), // Allow null for insufficient context
    evidence: z.array(evidenceItemSchema),
    confidence: z.number().min(0).max(1),
    diagram: z.string().optional(), // Optional Mermaid diagram

    // New: Insufficient context metadata
    state: z.enum(["complete", "tentative", "insufficient_context"]).optional(),
    requiredInfo: z.array(z.string()).optional(), // What data is needed
    suggestedQuestions: z.array(z.string()).optional(), // Questions to ask user
  });

/**
 * Timeline structure - flexible to handle user-configured fields
 */
export const timelineSchema = z.object({
  start: z.string().nullable().optional(),
  end: z.string().nullable().optional(),
  milestones: z.array(
    z.object({
      name: z.string(),
      date: z.string().optional(),
      description: z.string().optional(),
    })
  ).optional().default([]),
}).passthrough(); // Allow additional properties from user configuration

/**
 * Flexible array item - can be string or any object
 * This supports user-configured fields that may have different value types
 */
const flexibleArrayItem = z.union([
  z.string(),
  z.object({}).passthrough(), // Any object structure
  z.number(),
  z.boolean(),
]);

/**
 * Flexible array field - allows strings, objects, or mixed arrays
 */
const flexibleArray = z.array(flexibleArrayItem);

/**
 * Flexible field value - accepts string, array, or object
 * This is critical for supporting user-configured field types.
 * Users can change any field's type in settings, so the schema must accept all valid types.
 */
const flexibleFieldValue = z.union([
  z.string(),
  z.array(flexibleArrayItem),
  z.object({}).passthrough(),
  z.number(),
  z.boolean(),
]);

/**
 * Research report schema (shared between research tab and generation)
 */
export const researchReportSchema = z.object({
  competitorAnalysis: z.object({
    title: z.string(),
    content: z.string(),
    sources: z.array(z.object({ title: z.string(), url: z.string() })).optional().default([]),
  }),
  internalApplications: z.object({
    title: z.string(),
    content: z.string(),
    sources: z.array(z.object({ title: z.string(), url: z.string() })).optional().default([]),
  }),
  industryBenchmarks: z.object({
    title: z.string(),
    content: z.string(),
    sources: z.array(z.object({ title: z.string(), url: z.string() })).optional().default([]),
  }),
  estimatedImpact: z.object({
    title: z.string(),
    content: z.string(),
    sources: z.array(z.object({ title: z.string(), url: z.string() })).optional().default([]),
  }),
  recommendations: z.object({
    title: z.string(),
    content: z.string(),
    sources: z.array(z.object({ title: z.string(), url: z.string() })).optional().default([]),
  }),
  strategicImplications: z.object({
    title: z.string(),
    content: z.string(),
    sources: z.array(z.object({ title: z.string(), url: z.string() })).optional(),
  }).optional(),
  generatedAt: z.string().optional().default(() => new Date().toISOString()),
});

export type ResearchReport = z.infer<typeof researchReportSchema>;

/**
 * Benchmark entry for research & benchmarks tab
 */
export const benchmarkSchema = z.object({
  metric: z.string(),
  yourValue: z.string(),
  industryAverage: z.string(),
  topPerformers: z.string(),
  assessment: z.enum(["above", "at", "below"]).optional().default("at"),
  recommendation: z.string().optional(),
});

export type Benchmark = z.infer<typeof benchmarkSchema>;

/**
 * Solution recommendation with actions
 * Flexible to support user-configured field structures
 */
export const solutionSchema = z.object({
  value: z.union([z.string(), z.object({}).passthrough()]).nullable(),
  actions: z.array(
    z.union([
      z.string(), // Allow simple strings
      z.object({
        action: z.string(),
        priority: z.enum(["low", "medium", "high", "critical"]).optional(),
        owner: z.string().optional(),
      }).passthrough() // Allow additional properties
    ])
  ).optional().default([]),
  evidence: z.array(evidenceItemSchema).optional().default([]),
  confidence: z.number().min(0).max(1).optional().default(0.5),
  diagram: z.string().optional(), // Optional Mermaid diagram for action flow
  // Support insufficient context state
  state: z.enum(["complete", "tentative", "insufficient_context"]).optional(),
  requiredInfo: z.array(z.string()).optional(),
  suggestedQuestions: z.array(z.string()).optional(),
}).passthrough(); // Allow additional properties from user configuration

/**
 * Stakeholder information
 */
export const stakeholderSchema = z.object({
  name: z.string(),
  role: z.string(),
  influence: z.enum(["low", "medium", "high"]),
  interest: z.enum(["low", "medium", "high"]),
  raciRole: z.enum(["responsible", "accountable", "consulted", "informed"]).optional(),
});

/**
 * Budget breakdown
 */
export const budgetSchema = z.object({
  totalEstimate: z.string().optional(),
  breakdown: z.array(
    z.object({
      category: z.string(),
      amount: z.string(),
      notes: z.string().optional(),
    })
  ).optional(),
  resourceRequirements: z.array(z.string()).optional(),
  fteRequirements: z.string().optional(),
});

/**
 * Success criteria
 */
export const successCriteriaSchema = z.object({
  metric: z.string(),
  target: z.string(),
  measurement: z.string().optional(),
});

/**
 * Technical architecture component
 */
export const architectureComponentSchema = z.object({
  layer: z.string(),
  components: z.array(z.string()),
  description: z.string().optional(),
});

/**
 * ROI metrics
 */
export const roiSchema = z.object({
  expectedReturn: z.string().optional(),
  paybackPeriod: z.string().optional(),
  costBenefit: z.string().optional(),
  financialJustification: z.string().optional(),
});

/**
 * OKR (Objective and Key Result)
 */
export const okrSchema = z.object({
  id: z.string(),
  type: z.enum(["objective", "key-result"]),
  title: z.string(),
  description: z.string(),
  targetValue: z.string().optional(),
  currentValue: z.string().optional(),
  parentId: z.string().optional(), // For key results, references the objective
  dueDate: z.string().optional(),
  owner: z.string().optional(),
});

/**
 * Complete business canvas schema
 * Uses .passthrough() to allow team-specific custom fields
 * 
 * IMPORTANT: Field value types are flexible to support user-configured fields.
 * Users can customize field types in settings (string, array, object), so the
 * schema must accept all valid configurations without breaking validation.
 */
export const businessCanvasSchema = z.object({
  id: z.string(),
  title: fieldSchema(z.string()),
  problemStatement: fieldSchema(z.string()),
  // Use flexible arrays that accept strings OR objects to support user-configured fields
  objectives: fieldSchema(flexibleArray).optional(),
  kpis: fieldSchema(flexibleArray).optional(),
  // Urgency can be disabled in settings, so make it optional
  urgency: fieldSchema(
    z.enum(["low", "medium", "high", "critical"]).or(z.string())
  ).optional(),
  // Make timelines flexible - can be full object or partial/custom structure
  // All fields can be disabled in settings, so make them optional
  timelines: fieldSchema(z.union([
    timelineSchema,
    z.object({}).passthrough(), // Any object structure from user config
    z.string(), // Could be configured as string
    flexibleArray, // Could be configured as array
  ])).optional(),
  risks: fieldSchema(flexibleArray).optional(),
  keyFeatures: fieldSchema(flexibleArray).optional(),
  dependencies: fieldSchema(flexibleArray).optional(),
  dataDependencies: fieldSchema(flexibleArray).optional(),
  alignmentLongTerm: fieldSchema(z.union([z.string(), z.object({}).passthrough()])).optional(),
  solutionRecommendation: solutionSchema.optional(),

  // Optional additional fields (can be expanded later)
  // IMPORTANT: These fields use flexibleFieldValue to support user-configured types
  // Users can change field types in settings (string, array, object), so we must accept all
  okrs: fieldSchema(flexibleFieldValue).optional(),
  stakeholderMap: fieldSchema(flexibleFieldValue).optional(),
  budgetResources: fieldSchema(flexibleFieldValue).optional(),
  successCriteria: fieldSchema(flexibleFieldValue).optional(),
  assumptions: fieldSchema(flexibleFieldValue).optional(),
  technicalArchitecture: fieldSchema(flexibleFieldValue).optional(),
  securityCompliance: fieldSchema(flexibleFieldValue).optional(),
  changeManagement: fieldSchema(flexibleFieldValue).optional(),
  roiAnalysis: fieldSchema(flexibleFieldValue).optional(),

  // Research report (optional)
  research: researchReportSchema.optional(),
  benchmarks: z.array(benchmarkSchema).optional(),

  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.enum(["draft", "in_review", "approved", "rejected"]),
  uploadedFiles: z.array(z.string()).optional(), // Document IDs from RAG uploads
}).passthrough(); // Allow custom fields to pass through validation

export type BusinessCanvas = z.infer<typeof businessCanvasSchema>;

export type CanvasField<T = unknown> = {
  value: T | null;
  evidence: EvidenceItem[];
  confidence: number;
  diagram?: string; // Optional Mermaid diagram
  state?: "complete" | "tentative" | "insufficient_context";
  requiredInfo?: string[];
  suggestedQuestions?: string[];
};

/**
 * Helper to create an insufficient context field
 */
export function createInsufficientContextField<T>(
  requiredInfo: string[],
  suggestedQuestions: string[],
  confidence: number = 0.3
): CanvasField<T> {
  return {
    value: null,
    confidence,
    evidence: [],
    state: "insufficient_context",
    requiredInfo,
    suggestedQuestions,
  };
}

/**
 * Canvas generation request
 */
export const canvasGenerationRequestSchema = z.object({
  problemStatement: z.string().min(10),
  uploadedFiles: z.array(z.string()).optional(),
  mcpServers: z.array(z.string()).optional(),
  contextualInfo: z.string().optional(),
  research: researchReportSchema.optional(),
});

export type CanvasGenerationRequest = z.infer<
  typeof canvasGenerationRequestSchema
>;

/**
 * MCP server configuration
 *
 * SECURITY: Command whitelist to prevent RCE attacks
 * Only approved MCP server binaries are allowed
 */
const ALLOWED_MCP_COMMANDS = [
  '/usr/local/bin/mcp-server-filesystem',
  '/usr/local/bin/mcp-server-postgres',
  '/usr/local/bin/mcp-server-sqlite',
  'npx', // Allow npx for @modelcontextprotocol packages
  'node', // Allow node for local MCP servers
] as const;

/**
 * Validates MCP command is in whitelist
 */
function validateMcpCommand(command: unknown): boolean {
  if (typeof command !== 'string') return false;

  // Check exact match - convert readonly array to regular array for type safety
  const allowedCommands: string[] = [...ALLOWED_MCP_COMMANDS];
  return allowedCommands.includes(command);
}

/**
 * Validates MCP args don't contain shell injection attempts
 */
function validateMcpArgs(args: unknown): boolean {
  if (!Array.isArray(args)) return false;

  // Each arg must be a string
  if (!args.every(arg => typeof arg === 'string')) return false;

  // For npx commands, validate the package name
  const argsArray = args as string[];
  if (argsArray.length > 0) {
    const firstArg = argsArray[0];

    // If using npx, first arg should be a @modelcontextprotocol package or -y flag
    if (firstArg === '-y' || firstArg.startsWith('@modelcontextprotocol/')) {
      // Additional validation: no shell metacharacters in any args
      const dangerousChars = /[;&|`$()<>]/;
      return !argsArray.some(arg => dangerousChars.test(arg));
    }
  }

  // Check for shell metacharacters that could be used for injection
  const dangerousChars = /[;&|`$()<>]/;
  return !argsArray.some(arg => dangerousChars.test(arg));
}

/**
 * Validates environment variables
 */
function validateMcpEnv(env: unknown): boolean {
  if (typeof env !== 'object' || env === null) return false;

  const envObj = env as Record<string, unknown>;

  // All values must be strings
  return Object.values(envObj).every(val => typeof val === 'string');
}

export const mcpServerConfigSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  type: z.literal('stdio'), // Only support stdio for now
  config: z.object({
    command: z.string().refine(validateMcpCommand, {
      message: 'Command not in whitelist. Allowed: ' + ALLOWED_MCP_COMMANDS.join(', ')
    }),
    args: z.array(z.string()).optional().refine(
      (args) => !args || validateMcpArgs(args),
      { message: 'Invalid arguments: shell metacharacters detected or invalid package name' }
    ),
    env: z.record(z.string(), z.string()).optional().refine(
      (env) => !env || validateMcpEnv(env),
      { message: 'Environment variables must be strings' }
    ),
  }),
  enabled: z.boolean(),
  createdAt: z.string(),
});

export type McpServerConfig = z.infer<typeof mcpServerConfigSchema>;

/**
 * Chat message attachment
 */
export const chatAttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(), // MIME type
  size: z.number(),
  content: z.string(), // Base64 or text content
  url: z.string().optional(), // URL if stored externally
});

export type ChatAttachment = z.infer<typeof chatAttachmentSchema>;

/**
 * Chat message for card refinement
 */
export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  canvasId: z.string(),
  fieldName: z.string().optional(),
  timestamp: z.string(),
  attachments: z.array(chatAttachmentSchema).optional(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
