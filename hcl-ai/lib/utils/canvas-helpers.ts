import { nanoid } from "nanoid";
import type { BusinessCanvas, CanvasField, EvidenceItem } from "../validators/canvas-schema";

/**
 * Creates an empty field with default values
 */
export function createEmptyField<T>(defaultValue: T): CanvasField<T> {
  return {
    value: defaultValue,
    evidence: [],
    confidence: 0,
  };
}

/**
 * Creates an empty business canvas with default structure
 */
export function createEmptyCanvas(): BusinessCanvas {
  const now = new Date().toISOString();

  return {
    id: nanoid(),
    title: createEmptyField(""),
    problemStatement: createEmptyField(""),
    objectives: createEmptyField([]),
    kpis: createEmptyField([]),
    urgency: createEmptyField("medium"),
    timelines: createEmptyField({
      start: null,
      end: null,
      milestones: [],
    }),
    risks: createEmptyField([]),
    keyFeatures: createEmptyField([]),
    dependencies: createEmptyField([]),
    dataDependencies: createEmptyField([]),
    alignmentLongTerm: createEmptyField(""),
    solutionRecommendation: {
      value: "",
      actions: [],
      evidence: [],
      confidence: 0,
    },
    createdAt: now,
    updatedAt: now,
    status: "draft",
  };
}

/**
 * Determines if a field needs user attention based on confidence
 */
export function needsUserAttention(field: CanvasField<unknown>): boolean {
  return field.confidence < 0.5;
}

/**
 * Aggregates confidence across multiple fields
 */
export function aggregateConfidence(fields: CanvasField<unknown>[]): number {
  if (fields.length === 0) return 0;

  const sum = fields.reduce((acc, field) => acc + field.confidence, 0);
  return sum / fields.length;
}

/**
 * Formats evidence items for display
 */
export function formatEvidence(evidence: EvidenceItem[]): string {
  return evidence
    .map((item) => `[${item.source}] ${item.snippet}`)
    .join("\n");
}

/**
 * Extracts field names that have low confidence
 */
export function getLowConfidenceFields(canvas: BusinessCanvas): string[] {
  const fields: [string, CanvasField<unknown> | undefined][] = [
    ["title", canvas.title],
    ["problemStatement", canvas.problemStatement],
    ["objectives", canvas.objectives],
    ["kpis", canvas.kpis],
    ["urgency", canvas.urgency],
    ["timelines", canvas.timelines],
    ["risks", canvas.risks],
    ["keyFeatures", canvas.keyFeatures],
    ["dependencies", canvas.dependencies],
    ["dataDependencies", canvas.dataDependencies],
    ["alignmentLongTerm", canvas.alignmentLongTerm],
  ];

  return fields
    .filter(([, field]) => field && needsUserAttention(field))
    .map(([name]) => name);
}

/**
 * Converts camelCase to Title Case
 * e.g., "industryBenchmark" -> "Industry Benchmark"
 */
function camelCaseToTitleCase(camelCase: string): string {
  // Insert space before capital letters and split
  const words = camelCase.replace(/([A-Z])/g, ' $1').trim();

  // Capitalize first letter of each word
  return words
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Gets a human-readable label for a field name
 */
export function getFieldLabel(fieldName: string): string {
  const labels: Record<string, string> = {
    title: "Title",
    problemStatement: "Problem Statement",
    objectives: "Objectives",
    okrs: "OKRs (Objectives & Key Results)",
    kpis: "KPIs / Success Metrics",
    urgency: "Urgency",
    timelines: "Timelines",
    risks: "Risks",
    keyFeatures: "Key Features",
    dependencies: "Dependencies",
    dataDependencies: "Data Dependencies",
    alignmentLongTerm: "Alignment to Long-term Vision",
    solutionRecommendation: "Solution Recommendation",
    stakeholderMap: "Stakeholder Map",
    budgetResources: "Budget & Resources",
    successCriteria: "Success Criteria",
    assumptions: "Assumptions",
    technicalArchitecture: "Technical Architecture",
    securityCompliance: "Security & Compliance",
    changeManagement: "Change Management",
    roiAnalysis: "ROI Analysis",
  };

  // Return known label or convert camelCase to Title Case
  return labels[fieldName] || camelCaseToTitleCase(fieldName);
}

/**
 * Calculates overall canvas completion percentage
 */
export function getCanvasCompletion(canvas: BusinessCanvas): number {
  const fields = [
    canvas.title,
    canvas.problemStatement,
    canvas.objectives,
    canvas.kpis,
    canvas.urgency,
    canvas.timelines,
    canvas.risks,
    canvas.keyFeatures,
    canvas.dependencies,
    canvas.dataDependencies,
    canvas.alignmentLongTerm,
  ].filter((field): field is NonNullable<typeof field> => field !== undefined);

  if (fields.length === 0) return 0;

  const filledFields = fields.filter(
    (field) => field.confidence > 0 && hasValue(field.value)
  ).length;

  return Math.round((filledFields / fields.length) * 100);
}

/**
 * Checks if a field value is considered filled
 */
function hasValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    return Object.values(value).some((v) => v !== null && v !== undefined);
  }
  return true;
}

/**
 * Formats evidence source name for display
 */
export function formatSourceName(source: string): string {
  // Remove "mcp:" prefix
  let formatted = source.replace(/^mcp:/i, "");

  // Remove "upload:" prefix
  formatted = formatted.replace(/^upload:/i, "");

  // Convert underscores and hyphens to spaces
  formatted = formatted.replace(/[_-]/g, " ");

  // Capitalize first letter of each word
  formatted = formatted
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return formatted;
}

/**
 * Formats canvas status for display
 * Converts "in_review" to "In Review", "draft" to "Draft", etc.
 */
export function formatStatus(status: string): string {
  // Convert underscores to spaces
  const formatted = status.replace(/_/g, " ");

  // Capitalize first letter of each word
  return formatted
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
