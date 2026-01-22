import { z } from "zod";
import { governancePersonSchema, governanceSchema } from "./structured-field-schemas";
// import { successCriteriaSchema } from "./structured-field-schemas";

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
 * Kpi details
 */

export const kpisSchema = z.object({
  metric: z.string().optional(),
  baseline: z.string().optional(),
  target: z.string().optional(),
  measurementFrequency: z.string().optional()
}).passthrough(); // Allow additional properties from user configuration

/**
 * Key features details
 */

export const keyFeaturesSchema = z.object({
  description: z.string().optional(),
  features: z.string().optional()
}).passthrough(); // Allow additional properties from user configuration

/**
 * Risks details
 */

export const risksSchema = z.object({
  mitigation: z.string().optional(),
  risk: z.string().optional()
}).passthrough(); // Allow additional properties from user configuration

/**
 * Use case details
 */
export const useCaseSchema = z.object({
  actor: z.string().optional(),
  goal: z.string().optional(),
  scenario: z.string().optional(),
  useCases: z.string().optional()
}).passthrough(); // Allow additional properties from user configuration

/**
 * Governance details
 */
// export const governanceSchema = z.object({
//   approvers: z.array(governancePersonSchema).default([]),
//   reviewers: z.array(governancePersonSchema).default([]),
//   requirementLeads: z.array(governancePersonSchema).default([]),
// });

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
  kpis: fieldSchema(z.union([
    kpisSchema,
    z.object({}).passthrough(), // Any object structure from user config
    z.string(), // Could be configured as string
    flexibleArray, // Could be configured as array
  ])).optional(),
  successCriteria: fieldSchema(flexibleArray).optional(),
  keyFeatures: fieldSchema(z.union([
    keyFeaturesSchema,
    z.object({}).passthrough(), // Any object structure from user config
    z.string(), // Could be configured as string
    flexibleArray, // Could be configured as array
  ])).optional(),
  relevantFacts: fieldSchema(flexibleArray).optional(),
  risks: fieldSchema(z.union([
    risksSchema,
    z.object({}).passthrough(), // Any object structure from user config
    z.string(), // Could be configured as string
    flexibleArray, // Could be configured as array
  ])).optional(),
  assumptions: fieldSchema(flexibleArray).optional(),
  // Use the correct NFR object schema for nonFunctionalRequirements
  nonFunctionalRequirements: fieldSchema(
    z.union([
      // Import nfrSchema from structured-field-schemas if not already
      // nfrSchema,
      z.object({
        performance: z.array(z.string()).default([]),
        // usabilityAccessibility: z.array(z.string()).default([]),
        data_quality: z.array(z.string()).default([]),
        reliability: z.array(z.string()).default([]),
        security: z.array(z.string()).default([]),
        
      }).passthrough(),
      z.object({}).passthrough(), // fallback for user config
      z.string(),
      flexibleArray,
    ])
  ).optional(),
  useCase: fieldSchema(z.union([
    useCaseSchema,
    z.object({}).passthrough(), // Any object structure from user config
    z.string(), // Could be configured as string
    flexibleArray, // Could be configured as array
  ])).optional(),
  governance: fieldSchema(governanceSchema).optional(),




  // kpis: fieldSchema(flexibleArray).optional(),
  // // Urgency can be disabled in settings, so make it optional
  // urgency: fieldSchema(
  //   z.enum(["low", "medium", "high", "critical"]).or(z.string())
  // ).optional(),
  // // Make timelines flexible - can be full object or partial/custom structure
  // // All fields can be disabled in settings, so make them optional
  // useCase: fieldSchema(z.union([
  //   useCaseSchema,
  //   z.object({}).passthrough(), // Any object structure from user config
  //   z.string(), // Could be configured as string
  //   flexibleArray, // Could be configured as array
  // ])).optional(),
  // risks: fieldSchema(flexibleArray).optional(),
  // keyFeatures: fieldSchema(flexibleArray).optional(),
  // dependencies: fieldSchema(flexibleArray).optional(),
  // dataDependencies: fieldSchema(flexibleArray).optional(),
  // alignmentLongTerm: fieldSchema(z.union([z.string(), z.object({}).passthrough()])).optional(),
  // solutionRecommendation: solutionSchema.optional(),

  // Optional additional fields (can be expanded later)
  // IMPORTANT: These fields use flexibleFieldValue to support user-configured types
  // Users can change field types in settings (string, array, object), so we must accept all
  // okrs: fieldSchema(flexibleFieldValue).optional(),
  // stakeholderMap: fieldSchema(flexibleFieldValue).optional(),
  // budgetResources: fieldSchema(flexibleFieldValue).optional(),
  // successCriteria: fieldSchema(flexibleFieldValue).optional(),
  // assumptions: fieldSchema(flexibleFieldValue).optional(),
  // technicalArchitecture: fieldSchema(flexibleFieldValue).optional(),
  // securityCompliance: fieldSchema(flexibleFieldValue).optional(),
  // changeManagement: fieldSchema(flexibleFieldValue).optional(),
  // roiAnalysis: fieldSchema(flexibleFieldValue).optional(),

  createdAt: z.string(),
  updatedAt: z.string(),
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
  contextualInfo: z.string().optional(),
});

export type CanvasGenerationRequest = z.infer<typeof canvasGenerationRequestSchema>;

// /**
//  * Solution recommendation with actions
//  * Flexible to support user-configured field structures
//  */
// export const solutionSchema = z.object({
//   value: z.union([z.string(), z.object({}).passthrough()]).nullable(),
//   actions: z.array(
//     z.union([
//       z.string(), // Allow simple strings
//       z.object({
//         action: z.string(),
//         priority: z.enum(["low", "medium", "high", "critical"]).optional(),
//         owner: z.string().optional(),
//       }).passthrough() // Allow additional properties
//     ])
//   ).optional().default([]),
//   evidence: z.array(evidenceItemSchema).optional().default([]),
//   confidence: z.number().min(0).max(1).optional().default(0.5),
//   diagram: z.string().optional(), // Optional Mermaid diagram for action flow
//   // Support insufficient context state
//   state: z.enum(["complete", "tentative", "insufficient_context"]).optional(),
//   requiredInfo: z.array(z.string()).optional(),
//   suggestedQuestions: z.array(z.string()).optional(),
// }).passthrough(); // Allow additional properties from user configuration

// /**
//  * Stakeholder information
//  */
// export const stakeholderSchema = z.object({
//   name: z.string(),
//   role: z.string(),
//   influence: z.enum(["low", "medium", "high"]),
//   interest: z.enum(["low", "medium", "high"]),
//   raciRole: z.enum(["responsible", "accountable", "consulted", "informed"]).optional(),
// });

// /**
//  * Budget breakdown
//  */
// export const budgetSchema = z.object({
//   totalEstimate: z.string().optional(),
//   breakdown: z.array(
//     z.object({
//       category: z.string(),
//       amount: z.string(),
//       notes: z.string().optional(),
//     })
//   ).optional(),
//   resourceRequirements: z.array(z.string()).optional(),
//   fteRequirements: z.string().optional(),
// });

// /**
//  * Success criteria
//  */
// export const successCriteriaSchema = z.object({
//   metric: z.string(),
//   target: z.string(),
//   measurement: z.string().optional(),
// });

// /**
//  * Technical architecture component
//  */
// export const architectureComponentSchema = z.object({
//   layer: z.string(),
//   components: z.array(z.string()),
//   description: z.string().optional(),
// });

// /**
//  * ROI metrics
//  */
// export const roiSchema = z.object({
//   expectedReturn: z.string().optional(),
//   paybackPeriod: z.string().optional(),
//   costBenefit: z.string().optional(),
//   financialJustification: z.string().optional(),
// });

// /**
//  * OKR (Objective and Key Result)
//  */
// export const okrSchema = z.object({
//   id: z.string(),
//   type: z.enum(["objective", "key-result"]),
//   title: z.string(),
//   description: z.string(),
//   targetValue: z.string().optional(),
//   currentValue: z.string().optional(),
//   parentId: z.string().optional(), // For key results, references the objective
//   dueDate: z.string().optional(),
//   owner: z.string().optional(),
// });