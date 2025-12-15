import { z } from "zod";

/**
 * Supported industry verticals for contextualized canvas generation
 */
export const INDUSTRIES = [
  "ecommerce",
  "saas",
  "manufacturing",
  "retail",
  "healthcare",
  "financial_services",
  "logistics",
  "telecommunications",
  "energy",
  "other",
] as const;

export type Industry = (typeof INDUSTRIES)[number];

/**
 * Schema for individual company documents
 */
export const companyDocumentSchema = z.object({
  id: z.string(),
  filename: z.string().min(1, "Filename is required"),
  content: z.string(),
  mimeType: z.string().optional(),
  uploadedAt: z.string(),
});

export type CompanyDocument = z.infer<typeof companyDocumentSchema>;

/**
 * Field categories for organizing canvas fields
 */
export const FIELD_CATEGORIES = [
  "core",
  "planning",
  "technical",
  "financial",
  "risk_stakeholders",
  "custom",
] as const;

export type FieldCategory = (typeof FIELD_CATEGORIES)[number];

/**
 * Display styles for rendering field values
 * Controls how the field is displayed, not how it's generated
 */
export const DISPLAY_STYLES = [
  "auto",        // Auto-detect based on content (default)
  "paragraph",   // Single text block
  "bullets",     // Bullet list
  "numbered",    // Numbered list
  "comma",       // Comma-separated inline
  "table",       // Table format for structured data
] as const;

export type DisplayStyle = (typeof DISPLAY_STYLES)[number];

/**
 * Schema for field-specific document reference
 */
export const fieldDocumentSchema = z.object({
  id: z.string(), // Document ID
  filename: z.string(), // Original filename
  uploadedAt: z.string(), // ISO timestamp
});

export type FieldDocument = z.infer<typeof fieldDocumentSchema>;

/**
 * Schema for canvas field configuration
 */
export const fieldConfigurationSchema = z.object({
  id: z.string(), // "objectives" or nanoid for custom fields
  name: z.string(), // Display name "Objectives"
  fieldKey: z.string(), // camelCase for JSON "objectives"
  type: z.enum(["default", "custom"]), // Built-in or user-created
  category: z.enum(FIELD_CATEGORIES),

  // Visibility & Order
  enabled: z.boolean(), // Show/hide globally (if false, field is completely hidden)
  includeInGeneration: z.boolean().default(true), // Include in AI generation by default (if false, only available via Additional Fields)
  order: z.number(), // Display order (0-indexed)

  // AI Generation Config
  valueType: z.enum(["string", "array", "object"]),
  instructions: z.string(), // How to generate this field
  examples: z.string().optional(), // Example outputs
  negativePrompt: z.string().optional(), // What to avoid
  supportsDiagram: z.boolean().default(false), // Enable diagram generation

  // Display Config
  displayStyle: z.enum(DISPLAY_STYLES).default("auto"), // How to render the field value

  // Field-specific RAG documents
  documents: z.array(fieldDocumentSchema).optional(), // Documents specific to this field

  // Metadata
  isRequired: z.boolean().default(false), // Cannot be disabled
  description: z.string().optional(), // Help text for users
});

export type FieldConfiguration = z.infer<typeof fieldConfigurationSchema>;

/**
 * Supported LLM providers
 */
export const LLM_PROVIDERS = ["claude", "openai"] as const;

export type LlmProvider = (typeof LLM_PROVIDERS)[number];

/**
 * Access levels for field availability
 */
export const FIELD_ACCESS_LEVELS = [
  "hidden",    // Field is not shown
  "read",      // Visible but read-only
  "edit",      // Editable
  "required",  // Required for completion
] as const;

export type FieldAccessLevel = (typeof FIELD_ACCESS_LEVELS)[number];

/**
 * Schema for role definition
 */
export const roleDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  isSystem: z.boolean().default(false),
  permissions: z.object({
    canCreateCanvas: z.boolean().default(true).optional(),
    canEditCanvas: z.boolean().default(true).optional(),
    canShareCanvas: z.boolean().default(true).optional(),
    canManageFields: z.boolean().default(false).optional(),
    canManageTeams: z.boolean().default(false).optional(),
    canUploadDocs: z.boolean().default(true).optional(),
  }).optional(),
});

export type RoleDefinition = z.infer<typeof roleDefinitionSchema>;

/**
 * Schema for field availability settings
 */
const normalizeAccessRecord = (
  record: Record<string, string>
): Record<string, FieldAccessLevel> => {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      if (value === "hidden" || value === "read" || value === "edit") {
        return [key, value];
      }
      // Legacy value or invalid entry - treat as editable to avoid blocking users
      return [key, "edit"];
    })
  );
};

const accessRecordSchema = z
  .record(z.string(), z.enum(FIELD_ACCESS_LEVELS).catch("edit"))
  .transform((rec) => normalizeAccessRecord(rec))
  .or(
    z.record(z.string(), z.string()).transform((rec) => normalizeAccessRecord(rec))
  );

export const fieldAvailabilitySchema = z.object({
  fieldKey: z.string(),
  roleAccess: accessRecordSchema.optional(),
  teamAccess: accessRecordSchema.optional(),
});

export type FieldAvailability = z.infer<typeof fieldAvailabilitySchema>;

/**
 * Schema for company settings
 */
export const companySettingsSchema = z.object({
  id: z.string().optional(),
  companyName: z.string().min(1, "Company name is required").optional(),
  industry: z.enum(INDUSTRIES).optional(),
  companyInfo: z.string().optional(),
  llmProvider: z.enum(LLM_PROVIDERS).default("claude").optional(),
  claudeApiKey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  enableThinking: z.boolean().default(false).optional(),
  canvasFields: z.array(fieldConfigurationSchema).optional(), // Global field configuration
  roleDefinitions: z.array(roleDefinitionSchema).optional(), // Custom roles for access control
  fieldAvailability: z.array(fieldAvailabilitySchema).optional(), // Field visibility matrix
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type CompanySettings = z.infer<typeof companySettingsSchema>;

/**
 * Schema for settings with documents included
 */
export const companySettingsWithDocumentsSchema = companySettingsSchema.extend({
  documents: z.array(companyDocumentSchema).optional(),
});

export type CompanySettingsWithDocuments = z.infer<
  typeof companySettingsWithDocumentsSchema
>;

/**
 * Schema for settings update payload
 */
export const updateCompanySettingsSchema = companySettingsSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UpdateCompanySettings = z.infer<typeof updateCompanySettingsSchema>;

/**
 * Schema for document upload
 */
export const uploadDocumentSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  content: z.string().min(1, "Document content is required"),
  mimeType: z.string().optional(),
});

export type UploadDocument = z.infer<typeof uploadDocumentSchema>;

/**
 * Helper to get industry display name
 */
export function getIndustryDisplayName(industry: Industry): string {
  const displayNames: Record<Industry, string> = {
    ecommerce: "E-commerce",
    saas: "SaaS",
    manufacturing: "Manufacturing",
    retail: "Retail",
    healthcare: "Healthcare",
    financial_services: "Financial Services",
    logistics: "Logistics & Supply Chain",
    telecommunications: "Telecommunications",
    energy: "Energy & Utilities",
    other: "Other",
  };

  return displayNames[industry] || industry;
}

/**
 * Helper to get LLM provider display name
 */
export function getLlmProviderDisplayName(provider: LlmProvider): string {
  const displayNames: Record<LlmProvider, string> = {
    claude: "Claude (Anthropic)",
    openai: "OpenAI",
  };

  return displayNames[provider] || provider;
}
