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

import { z } from "zod";

// ============================================================================
// KPIS
// Structure: Array of KPI objects
// ============================================================================

export const kpiSchema = z.object({
  baseline: z.string().default(""),
  metric: z.string().default(""),
  target: z.string().default(""),
  measurement_frequency: z.string().default(""),
});

export type KPIValue = z.infer<typeof kpiSchema>;

export const kpisSchema = z.array(kpiSchema);

export const KPIS_FIELD_LABELS = {
  baseline: "Baseline",
  metric: "Metric",
  target: "Target",
  measurement_frequency: "Measurement Frequency",
} as const;

// ============================================================================
// KEY FEATURES
// Structure: Array of feature objects
// ============================================================================

export const keyFeatureSchema = z.object({
  feature: z.string().default(""),
  description: z.string().default(""),
  priority: z.string().optional(),
});

export type KeyFeatureValue = z.infer<typeof keyFeatureSchema>;

export const keyFeaturesSchema = z.array(keyFeatureSchema);

export const KEY_FEATURES_FIELD_LABELS = {
  feature: "Feature",
  description: "Description",
  priority: "Priority",
} as const;

// ============================================================================
// RISKS
// Structure: Array of risk objects
// ============================================================================

export const riskSchema = z.object({
  risk: z.string().default(""),
  mitigation: z.string().default(""),
});

export type RiskValue = z.infer<typeof riskSchema>;

export const risksSchema = z.array(riskSchema);

export const RISKS_FIELD_LABELS = {
  risk: "Risk",
  mitigation: "Mitigation",
} as const;

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
  use_case: z.string().default(""),
  actor: z.string().default(""),
  goal: z.string().default(""),
  scenario: z.string().default(""),
});

export type UseCaseValue = z.infer<typeof useCaseSchema>;

export const useCasesSchema = z.array(useCaseSchema);

export const USE_CASE_FIELD_LABELS = {
  use_case: "Use Case",
  actor: "Actor",
  goal: "Goal",
  scenario: "Scenario",
} as const;

// ============================================================================
// GOVERNANCE
// Structure: Object with approvers and reviewers arrays
// ============================================================================

export const governancePersonSchema = z.object({
  role: z.string(),
  name: z.string(),
  function: z.string(),
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
  name: "Name",
  function: "Function",
} as const;

export const GOVERNANCE_CATEGORY_LABELS = {
  approvers: "Sign-off Approvers",
  reviewers: "Reviewers",
  requirementLeads: "Requirement Leads",
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type StructuredFieldType =
  | "category-list"      // NFR, Scope (object with category arrays)
  | "timeline"           // Timelines (dates + milestones)
  | "card-array"         // KPIs, Features, Risks, Use Cases, etc.
  | "governance"         // Governance (approvers/reviewers)
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
    case "kpis":
      return {
        type: "card-array",
        schema: kpisSchema,
        emptyValue: [],
      };

    case "keyFeatures":
      return {
        type: "card-array",
        schema: keyFeaturesSchema,
        emptyValue: [],
      };

    case "risks":
      return {
        type: "card-array",
        schema: risksSchema,
        emptyValue: [],
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
        emptyValue: [],
      };

    case "governance":
      return {
        type: "governance",
        schema: governanceSchema,
        emptyValue: { approvers: [], reviewers: [], requirementLeads: [] },
      };

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