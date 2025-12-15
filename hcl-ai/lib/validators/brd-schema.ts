import { z } from "zod";

/**
 * BRD Reviewer schema
 */
export const brdReviewerSchema = z.object({
  role: z.string(),
  name: z.string().optional(),
  function: z.string().optional(),
});

export type BRDReviewer = z.infer<typeof brdReviewerSchema>;

/**
 * BRD Approver schema
 */
export const brdApproverSchema = z.object({
  role: z.string(),
  name: z.string().optional(),
  function: z.string().optional(),
});

export type BRDApprover = z.infer<typeof brdApproverSchema>;

/**
 * Glossary term schema
 */
export const glossaryTermSchema = z.object({
  term: z.string(),
  definition: z.string(),
});

export type GlossaryTerm = z.infer<typeof glossaryTermSchema>;

/**
 * Non-Functional Requirement schema
 */
export const nfrSchema = z.object({
  id: z.string(),
  category: z.enum([
    "Performance",
    "Security",
    "Scalability",
    "Availability",
    "Reliability",
    "Usability",
    "Accessibility",
    "Compliance",
    "Data",
    "Integration",
    "Other",
  ]),
  requirement: z.string(),
  acceptanceCriteria: z.string(),
  priority: z.enum(["P1", "P2", "P3", "P4"]),
});

export type NFR = z.infer<typeof nfrSchema>;

/**
 * Feature for BRD (different from Story features - more detailed)
 */
export const brdFeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  businessRequirements: z.string(),
  dataRequirements: z.string().optional(),
  reportingRequirements: z.string().optional(),
  acceptanceCriteria: z.string(),
  priority: z.enum(["P1", "P2", "P3", "P4"]),
});

export type BRDFeature = z.infer<typeof brdFeatureSchema>;

/**
 * Use Case schema
 */
export const useCaseSchema = z.object({
  id: z.string(),
  description: z.string(),
  priority: z.enum(["P1", "P2", "P3", "P4"]),
});

export type UseCase = z.infer<typeof useCaseSchema>;

/**
 * Scope Item schema
 */
export const scopeItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  category: z.enum(["in_scope", "out_of_scope", "undecided"]),
});

export type ScopeItem = z.infer<typeof scopeItemSchema>;

/**
 * Risk and Mitigation schema for BRD
 */
export const brdRiskSchema = z.object({
  id: z.string(),
  risk: z.string(),
  mitigation: z.string(),
});

export type BRDRisk = z.infer<typeof brdRiskSchema>;

/**
 * Key Result schema for BRD
 */
export const brdKeyResultSchema = z.object({
  id: z.string(),
  objective: z.string(),
  keyResults: z.array(z.string()),
});

export type BRDKeyResult = z.infer<typeof brdKeyResultSchema>;

/**
 * BRD Metadata schema - user-provided information
 */
export const brdMetadataSchema = z.object({
  // Required fields
  brdOwner: z.string(),
  programName: z.string(),

  // Optional fields (can be added progressively)
  portfolioEpic: z.string().optional(),
  brdApprover: z.string().optional(),
  approvalDate: z.string().optional(),
  version: z.string().optional(),

  // Governance
  signOffApprovers: z.array(brdApproverSchema).optional(),
  reviewers: z.array(brdReviewerSchema).optional(),

  // Glossary
  glossaryTerms: z.array(glossaryTermSchema).optional(),

  // References
  relatedDocuments: z.array(z.object({
    name: z.string(),
    url: z.string().optional(),
  })).optional(),
});

export type BRDMetadata = z.infer<typeof brdMetadataSchema>;

/**
 * BRD Section schema - AI-generated content
 */
export const brdSectionSchema = z.object({
  title: z.string(),
  content: z.string(),
  isEdited: z.boolean().optional(), // Track if user has edited this section
});

export type BRDSection = z.infer<typeof brdSectionSchema>;

/**
 * Complete BRD Document schema
 */
export const brdDocumentSchema = z.object({
  // Document info
  id: z.string(),
  canvasId: z.string(),
  generatedAt: z.string(),
  updatedAt: z.string(),

  // Metadata (user-provided)
  metadata: brdMetadataSchema,

  // AI-Generated Sections
  executiveSummary: brdSectionSchema,

  // Objective section
  objective: z.object({
    businessGoal: z.string(),
    what: z.string(),
    why: z.string(),
    impact: z.string(),
  }),

  // Success criteria with key results
  successCriteria: z.array(brdKeyResultSchema),

  // Use cases
  useCases: z.array(useCaseSchema),

  // Scope
  scope: z.array(scopeItemSchema),

  // Non-Functional Requirements
  nonFunctionalRequirements: z.array(nfrSchema),

  // Assumptions and Constraints
  assumptions: z.array(z.string()),
  constraints: z.array(z.string()),

  // Risks and Mitigations
  risks: z.array(brdRiskSchema),

  // Features (detailed table)
  features: z.array(brdFeatureSchema),

  // Completeness tracking
  completeness: z.object({
    percentage: z.number(),
    missingFields: z.array(z.string()),
  }),
});

export type BRDDocument = z.infer<typeof brdDocumentSchema>;

/**
 * BRD Generation Request schema
 */
export const brdGenerationRequestSchema = z.object({
  canvasId: z.string(),
  metadata: z.object({
    brdOwner: z.string().min(1, "BRD Owner is required"),
    programName: z.string().min(1, "Program Name is required"),
    portfolioEpic: z.string().optional(),
  }),
  // Optional: import metadata from another canvas
  importFromCanvasId: z.string().optional(),
});

export type BRDGenerationRequest = z.infer<typeof brdGenerationRequestSchema>;

/**
 * BRD Update Request schema
 */
export const brdUpdateRequestSchema = z.object({
  canvasId: z.string(),
  metadata: brdMetadataSchema.partial().optional(),
  // Allow updating individual sections
  sections: z.record(z.string(), z.string()).optional(),
});

export type BRDUpdateRequest = z.infer<typeof brdUpdateRequestSchema>;

/**
 * Calculate BRD completeness
 */
export function calculateBRDCompleteness(metadata: BRDMetadata): {
  percentage: number;
  missingFields: string[];
} {
  const missingFields: string[] = [];
  let filledCount = 0;
  const totalOptionalFields = 6; // Approver, approval date, version, sign-off, reviewers, glossary

  // Check optional fields
  if (metadata.brdApprover) filledCount++;
  else missingFields.push("BRD Approver");

  if (metadata.approvalDate) filledCount++;
  else missingFields.push("Approval Date");

  if (metadata.version) filledCount++;
  else missingFields.push("Version");

  if (metadata.signOffApprovers && metadata.signOffApprovers.length > 0) filledCount++;
  else missingFields.push("Sign-off Approvers");

  if (metadata.reviewers && metadata.reviewers.length > 0) filledCount++;
  else missingFields.push("Reviewers");

  if (metadata.glossaryTerms && metadata.glossaryTerms.length > 0) filledCount++;
  else missingFields.push("Glossary Terms");

  // Required fields are always filled (they're required for generation)
  // So we only track optional field completeness
  const percentage = Math.round((filledCount / totalOptionalFields) * 100);

  return {
    percentage,
    missingFields,
  };
}

/**
 * Default approver roles
 */
export const DEFAULT_APPROVER_ROLES = [
  "Business Portfolio Epic Lead",
  "GTS Portfolio Epic Lead",
];

/**
 * Default reviewer roles
 */
export const DEFAULT_REVIEWER_ROLES = [
  "Business Capability Lead",
  "GTS Capability Lead",
  "Business Stakeholder",
  "Architecture Lead",
  "Data PdM Lead",
];

/**
 * NFR Categories with descriptions
 */
export const NFR_CATEGORIES = [
  { value: "Performance", description: "Response time, throughput, latency requirements" },
  { value: "Security", description: "Authentication, authorization, data protection" },
  { value: "Scalability", description: "Ability to handle growth in users/data" },
  { value: "Availability", description: "Uptime requirements, SLAs" },
  { value: "Reliability", description: "Fault tolerance, recovery capabilities" },
  { value: "Usability", description: "User experience, ease of use" },
  { value: "Accessibility", description: "WCAG compliance, assistive technology support" },
  { value: "Compliance", description: "Regulatory and legal requirements" },
  { value: "Data", description: "Data quality, retention, migration" },
  { value: "Integration", description: "API standards, interoperability" },
  { value: "Other", description: "Other non-functional requirements" },
] as const;
