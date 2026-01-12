/**
 * Structured Field Schemas
 *
 * This file defines the exact schemas for complex structured fields.
 * These schemas are used for:
 * 1. Type safety in the structured field editor
 * 2. Validation before saving
 * 3. Ensuring data integrity when sending to/receiving from LLM
 *
 * IMPORTANT: These schemas MUST match what the LLM is instructed to output
 * in services/llm/prompts.ts FIELD_STRUCTURE_INSTRUCTIONS
 */

import { use } from "react";
import { z } from "zod";


// ============================================================================
// KPIS
// Structure: Object with category keys, each containing an array of requirement strings
// ============================================================================

export const kpisCategoryKeys = [
  "baseline",
  "metric",
  "target",
  "measurementFrequency",
] as const;

export type KPISCategoryKey = typeof kpisCategoryKeys[number];

export const kpisSchema = z.object({
  baseline: z.array(z.string()).default([]),
  metric: z.array(z.string()).default([]),
  target: z.array(z.string()).default([]),
  measurementFrequency: z.array(z.string()).default([]),
});

export type KPISValue = z.infer<typeof kpisSchema>;

export const KPIS_CATEGORY_LABELS: Record<KPISCategoryKey, string> = {
  baseline: "Baseline",
  metric: "Metric",
  target: "Target",
  measurementFrequency: "Measurement Frequency",
};

// ============================================================================
// KEY FEATURES
// Structure: Object with category keys, each containing an array of requirement strings
// ============================================================================

export const keyFeaturesCategoryKeys = [
  "description",
  "features",
] as const;

export type KeyFeaturesCategoryKey = typeof keyFeaturesCategoryKeys[number];

export const keyFeaturesSchema = z.object({
  description: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
});

export type KeyFeaturesValue = z.infer<typeof keyFeaturesSchema>;
export const KEY_FEATURES_CATEGORY_LABELS: Record<KeyFeaturesCategoryKey, string> = {
  description: "Description",
  features: "Feature",
};

// ============================================================================
// RISKS
// Structure: Object with category keys, each containing an array of requirement strings
// ============================================================================

export const risksCategoryKeys = [
  "mitigation",
  "risk",
] as const;

export type RISKSCategoryKey = typeof risksCategoryKeys[number];

export const risksSchema = z.object({
  mitigation: z.array(z.string()).default([]),
  risk: z.array(z.string()).default([]),
});

export type RISKSValue = z.infer<typeof risksSchema>;

export const RISKS_CATEGORY_LABELS: Record<RISKSCategoryKey, string> = {
  mitigation: "Mitigation",
  risk: "Risk",
};

// ============================================================================
// NON-FUNCTIONAL REQUIREMENTS (NFR)
// Structure: Object with category keys, each containing an array of requirement strings
// ============================================================================

export const nfrCategoryKeys = [
  "performanceRequirements",
  "usabilityAccessibility",
  "reliabilityAvailability",
  "securityPrivacy",
  "dataQualityIntegration",
] as const;

export type NFRCategoryKey = typeof nfrCategoryKeys[number];

export const nfrSchema = z.object({
  performanceRequirements: z.array(z.string()).default([]),
  usabilityAccessibility: z.array(z.string()).default([]),
  reliabilityAvailability: z.array(z.string()).default([]),
  securityPrivacy: z.array(z.string()).default([]),
  dataQualityIntegration: z.array(z.string()).default([]),
});

export type NFRValue = z.infer<typeof nfrSchema>;

export const NFR_CATEGORY_LABELS: Record<NFRCategoryKey, string> = {
  performanceRequirements: "Performance Requirements",
  usabilityAccessibility: "Usability & Accessibility",
  reliabilityAvailability: "Reliability & Availability",
  securityPrivacy: "Security & Privacy",
  dataQualityIntegration: "Data Quality & Integration",
};


// ============================================================================
// USE CASES
// Structure: Array of use case objects
// ============================================================================

export const useCaseSchema = z.object({
  actor: z.string().default(""),
  goal: z.string().default(""),
  scenario: z.string().default(""),
  useCases: z.string().default(""),
});

export type UseCaseValue = z.infer<typeof useCaseSchema>;

export const useCasesSchema = z.array(useCaseSchema);

export const USE_CASE_FIELD_LABELS = {
  actor: "Actor",
  goal: "Goal",
  scenario: "Scenario",
  useCases: "Use Cases",
} as const;

// ============================================================================
// GOVERNANCE
// Structure: Object with approvers and reviewers arrays
// ============================================================================

export const governancePersonSchema = z.object({
  role: z.string(),
  responsibility: z.string(),
  authority: z.string(),
});

export type GovernancePersonValue = z.infer<typeof governancePersonSchema>;

export const governanceSchema = z.object({
  approvers: z.array(governancePersonSchema).default([]),
  reviewers: z.array(governancePersonSchema).default([]),
  requirementLeads: z.array(governancePersonSchema).default([]),
});

export type GovernanceValue = z.infer<typeof governanceSchema>;

export const GOVERNANCE_PERSON_FIELD_LABELS = {
  role: "Role",
  responsibility: "Responsibility",
  authority: "Authority",
} as const;

export const GOVERNANCE_CATEGORY_LABELS = {
  approvers: "Sign-off Approvers",
  reviewers: "Reviewers",
  requirementLeads: "Requirement Leads",
} as const;

// ============================================================================
// SCOPE DEFINITION
// Structure: Object with inScope and outOfScope arrays
// ============================================================================

// export const scopeDefinitionSchema = z.object({
//   inScope: z.array(z.string()).default([]),
//   outOfScope: z.array(z.string()).default([]),
// });

// export type ScopeDefinitionValue = z.infer<typeof scopeDefinitionSchema>;

// export const SCOPE_CATEGORY_LABELS = {
//   inScope: "In Scope",
//   outOfScope: "Out of Scope",
// } as const;

// ============================================================================
// TIMELINES
// Structure: Object with start/end dates and milestones array
// ============================================================================

// export const milestoneSchema = z.object({
//   name: z.string().min(1, "Milestone name is required"),
//   date: z.string().min(1, "Milestone date is required"),
//   description: z.string().optional(),
// });

// export type MilestoneValue = z.infer<typeof milestoneSchema>;

// export const timelinesSchema = z.object({
//   start: z.string().nullable().default(null),
//   end: z.string().nullable().default(null),
//   milestones: z.array(milestoneSchema).default([]),
// });

// export type TimelinesValue = z.infer<typeof timelinesSchema>;

// ============================================================================
// PERSONAS
// Structure: Array of persona objects
// ============================================================================

// export const personaSchema = z.object({
//   name: z.string().min(1, "Persona name is required"),
//   profile: z.string().default(""),
//   needs: z.string().default(""),
//   painPoints: z.string().default(""),
//   successDefinition: z.string().default(""),
// });

// export type PersonaValue = z.infer<typeof personaSchema>;

// export const personasSchema = z.array(personaSchema);

// export type PersonasValue = z.infer<typeof personasSchema>;

// export const PERSONA_FIELD_LABELS = {
//   name: "Name",
//   profile: "Profile",
//   needs: "Needs",
//   painPoints: "Pain Points",
//   successDefinition: "Success Definition",
// } as const;



// ============================================================================
// STAKEHOLDER MAP
// Structure: Array of stakeholder objects with enum values for influence/interest
// ============================================================================

// export const stakeholderLevels = ["low", "medium", "high"] as const;
// export type StakeholderLevel = typeof stakeholderLevels[number];

// export const raciRoles = ["responsible", "accountable", "consulted", "informed"] as const;
// export type RACIRole = typeof raciRoles[number];

// export const stakeholderSchema = z.object({
//   name: z.string().min(1, "Stakeholder name is required"),
//   role: z.string().default(""),
//   influence: z.enum(stakeholderLevels).default("medium"),
//   interest: z.enum(stakeholderLevels).default("medium"),
//   raciRole: z.enum(raciRoles).optional(),
// });

// export type StakeholderValue = z.infer<typeof stakeholderSchema>;

// export const stakeholderMapSchema = z.array(stakeholderSchema);

// export type StakeholderMapValue = z.infer<typeof stakeholderMapSchema>;

// export const STAKEHOLDER_LEVEL_LABELS: Record<StakeholderLevel, string> = {
//   low: "Low",
//   medium: "Medium",
//   high: "High",
// };

// export const RACI_ROLE_LABELS: Record<RACIRole, string> = {
//   responsible: "Responsible",
//   accountable: "Accountable",
//   consulted: "Consulted",
//   informed: "Informed",
// };

// ============================================================================
// SUCCESS CRITERIA
// Structure: Array of criteria objects with metric, target, measurement
// ============================================================================

// export const successCriterionSchema = z.object({
//   metric: z.string().min(1, "Metric is required"),
//   target: z.string().default(""),
//   measurement: z.string().default(""),
// });

// export type SuccessCriterionValue = z.infer<typeof successCriterionSchema>;

// export const successCriteriaSchema = z.array(successCriterionSchema);

// export type SuccessCriteriaValue = z.infer<typeof successCriteriaSchema>;

// export const SUCCESS_CRITERIA_FIELD_LABELS = {
//   metric: "Metric",
//   target: "Target",
//   measurement: "Measurement",
// } as const;

// ============================================================================
// BUDGET / RESOURCES
// Structure: Object with totalEstimate, breakdown array, and optional FTE
// ============================================================================

// export const budgetBreakdownSchema = z.object({
//   category: z.string().min(1, "Category is required"),
//   amount: z.string().default(""),
//   notes: z.string().optional(),
// });

// export type BudgetBreakdownValue = z.infer<typeof budgetBreakdownSchema>;

// export const budgetResourcesSchema = z.object({
//   totalEstimate: z.string().default(""),
//   breakdown: z.array(budgetBreakdownSchema).default([]),
//   fteRequirements: z.string().optional(),
// });

// export type BudgetResourcesValue = z.infer<typeof budgetResourcesSchema>;

// export const BUDGET_BREAKDOWN_FIELD_LABELS = {
//   category: "Category",
//   amount: "Amount",
//   notes: "Notes",
// } as const;


// ============================================================================
// OKRs (Objectives and Key Results)
// Structure: Array of objective/key-result objects with hierarchy
// ============================================================================

// export const okrSchema = z.discriminatedUnion("type", [
//   z.object({
//     id: z.string(),
//     type: z.literal("objective"),
//     title: z.string().min(1, "Title is required"),
//     description: z.string().default(""),
//   }),
//   z.object({
//     id: z.string(),
//     type: z.literal("key-result"),
//     title: z.string().min(1, "Title is required"),
//     description: z.string().default(""),
//     parentId: z.string().min(1, "Parent objective is required"),
//     targetValue: z.string().default(""),
//     currentValue: z.string().default(""),
//   }),
// ]);

// export type OKRValue = z.infer<typeof okrSchema>;

// export const okrsSchema = z.array(okrSchema);

// export type OKRsValue = z.infer<typeof okrsSchema>;


export type StructuredFieldType =
  | "category-list"      // NFR, Scope (object with category arrays)
  | "timeline"           // Timelines (dates + milestones)
  | "card-array"         // Personas, Use Cases, Stakeholders, etc.
  | "governance"         // Governance (approvers/reviewers)
  // | "budget"             // Budget (total + breakdown)
  // | "okr"               // OKRs (hierarchical objectives + key results)
  | "simple-list"        // Simple string arrays
  | "text"              // Plain text (default)
  | "unknown-object";   // Unknown object structure - show read-only or JSON


export interface StructuredFieldConfig {
  type: StructuredFieldType;
  schema: z.ZodType<unknown>;
  emptyValue: unknown;
}

/**
 * Determines the editor type and schema for a given field key
 */
export function getStructuredFieldConfig(fieldKey: string): StructuredFieldConfig | null {
  switch (fieldKey) {

    case "KPIs":
      return {
        type: "card-array",
        schema: kpisSchema,
        emptyValue: { baseline: [], metric: [], target: [], measurementFrequency: []},
      };

    case "keyFeatures":
      return {
        type: "card-array",
        schema: keyFeaturesSchema,
        emptyValue: { description: [], features: [] },
      };

    case "risks":
      return {
        type: "card-array",
        schema: risksSchema,
        emptyValue: { mitigation: [], risk: []},
      };

      case "nonFunctionalRequirements":
      return {
        type: "category-list",
        schema: nfrSchema,
        emptyValue: {
          performanceRequirements: [],
          usabilityAccessibility: [],
          reliabilityAvailability: [],
          securityPrivacy: [],
          dataQualityIntegration: [],
        },
      };

    case "useCases":
      return {
        type: "card-array",
        schema: useCasesSchema,
        emptyValue: { actor: [], goal: [], scenario: [], useCases: []},
      };

    case "governance":
      return {
        type: "governance",
        schema: governanceSchema,
        emptyValue: { approvers: [], reviewers: [], requirementLeads: [] },
      };


    // case "stakeholderMap":
    //   return {
    //     type: "card-array",
    //     schema: stakeholderMapSchema,
    //     emptyValue: [],
    //   };

    // case "successCriteria":
    //   return {
    //     type: "card-array",
    //     schema: successCriteriaSchema,
    //     emptyValue: [],
    //   };

    // case "budgetResources":
    //   return {
    //     type: "budget",
    //     schema: budgetResourcesSchema,
    //     emptyValue: { totalEstimate: "", breakdown: [], fteRequirements: "" },
    //   };

    // case "okrs":
    //   return {
    //     type: "okr",
    //     schema: okrsSchema,
    //     emptyValue: [],
    //   };

    default:
      return null;
  }
}

/**
 * Validates a field value against its schema
 * Returns the validated value or null if invalid
 */
export function validateStructuredField(
  fieldKey: string,
  value: unknown
): { success: true; data: unknown } | { success: false; error: string } {
  const config = getStructuredFieldConfig(fieldKey);

  if (!config) {
    // No schema defined - allow any value
    return { success: true, data: value };
  }

  try {
    const result = config.schema.safeParse(value);
    if (result.success) {
      return { success: true, data: result.data };
    }

    // Format error message
    const errors = result.error.issues.map(issue =>
      `${issue.path.join(".")}: ${issue.message}`
    ).join("; ");

    return { success: false, error: errors };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Validation failed"
    };
  }
}

/**
 * Determines if a value is a structured type that needs a special editor
 * vs a simple string/array that can use basic editing
 */
export function isStructuredValue(fieldKey: string, value: unknown): boolean {
  const config = getStructuredFieldConfig(fieldKey);
  if (config) return true;

  // Check if it's an object (but not array) that we don't have a schema for
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return true;
  }

  // Check if it's an array of objects
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
    return true;
  }

  return false;
}

/**
 * Gets an empty/default value for a structured field
 */
export function getEmptyStructuredValue(fieldKey: string): unknown {
  const config = getStructuredFieldConfig(fieldKey);
  return config?.emptyValue ?? "";
}

/**
 * Normalizes a value to match the expected schema structure
 * Useful when data might be partially populated or have extra fields
 */
export function normalizeStructuredValue(fieldKey: string, value: unknown): unknown {
  const config = getStructuredFieldConfig(fieldKey);
  if (!config) return value;

  // Try to parse and coerce to the schema
  const result = config.schema.safeParse(value);
  if (result.success) {
    return result.data;
  }

  // If parsing failed, return empty value
  console.warn(`Failed to normalize ${fieldKey}:`, result.error);
  return config.emptyValue;
}
