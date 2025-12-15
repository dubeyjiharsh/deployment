/**
 * Field relevance utilities for progressive disclosure
 */

export type OptionalFieldKey =
  | "okrs"
  | "stakeholderMap"
  | "budgetResources"
  | "successCriteria"
  | "assumptions"
  | "technicalArchitecture"
  | "securityCompliance"
  | "changeManagement"
  | "roiAnalysis";

/**
 * Industry-specific field relevance mapping
 * Fields are ordered by importance for each industry
 */
const INDUSTRY_FIELD_RELEVANCE: Record<string, OptionalFieldKey[]> = {
  ecommerce: [
    "okrs",
    "budgetResources",
    "technicalArchitecture",
    "successCriteria",
    "stakeholderMap",
    "securityCompliance",
    "assumptions",
    "roiAnalysis",
    "changeManagement",
  ],
  saas: [
    "okrs",
    "successCriteria",
    "technicalArchitecture",
    "stakeholderMap",
    "roiAnalysis",
    "budgetResources",
    "assumptions",
    "securityCompliance",
    "changeManagement",
  ],
  retail: [
    "okrs",
    "budgetResources",
    "successCriteria",
    "stakeholderMap",
    "technicalArchitecture",
    "changeManagement",
    "assumptions",
    "roiAnalysis",
    "securityCompliance",
  ],
  manufacturing: [
    "okrs",
    "budgetResources",
    "stakeholderMap",
    "technicalArchitecture",
    "successCriteria",
    "securityCompliance",
    "assumptions",
    "changeManagement",
    "roiAnalysis",
  ],
  healthcare: [
    "okrs",
    "securityCompliance",
    "stakeholderMap",
    "changeManagement",
    "assumptions",
    "budgetResources",
    "successCriteria",
    "technicalArchitecture",
    "roiAnalysis",
  ],
  financial_services: [
    "okrs",
    "securityCompliance",
    "roiAnalysis",
    "assumptions",
    "stakeholderMap",
    "budgetResources",
    "successCriteria",
    "technicalArchitecture",
    "changeManagement",
  ],
  logistics: [
    "okrs",
    "budgetResources",
    "technicalArchitecture",
    "stakeholderMap",
    "successCriteria",
    "assumptions",
    "securityCompliance",
    "roiAnalysis",
    "changeManagement",
  ],
  telecommunications: [
    "okrs",
    "technicalArchitecture",
    "securityCompliance",
    "budgetResources",
    "stakeholderMap",
    "successCriteria",
    "assumptions",
    "roiAnalysis",
    "changeManagement",
  ],
  energy: [
    "okrs",
    "technicalArchitecture",
    "stakeholderMap",
    "budgetResources",
    "securityCompliance",
    "assumptions",
    "successCriteria",
    "changeManagement",
    "roiAnalysis",
  ],
  other: [
    "okrs",
    "stakeholderMap",
    "budgetResources",
    "successCriteria",
    "assumptions",
    "technicalArchitecture",
    "securityCompliance",
    "changeManagement",
    "roiAnalysis",
  ],
};

/**
 * Get relevant fields for a given industry
 * Returns top N most relevant fields (default: 4)
 */
export function getRelevantFields(
  industry: string = "other",
  topN: number = 4
): OptionalFieldKey[] {
  const fields = INDUSTRY_FIELD_RELEVANCE[industry] || INDUSTRY_FIELD_RELEVANCE.other;
  return fields.slice(0, topN);
}

/**
 * Check if a field is relevant for a given industry
 * A field is considered relevant if it's in the top N (default: 4)
 */
export function isFieldRelevant(
  fieldKey: string,
  industry: string = "other",
  topN: number = 4
): boolean {
  const relevantFields = getRelevantFields(industry, topN);
  return relevantFields.includes(fieldKey as OptionalFieldKey);
}

/**
 * Get all optional field keys
 */
export function getAllOptionalFields(): OptionalFieldKey[] {
  return [
    "okrs",
    "stakeholderMap",
    "budgetResources",
    "successCriteria",
    "assumptions",
    "technicalArchitecture",
    "securityCompliance",
    "changeManagement",
    "roiAnalysis",
  ];
}
