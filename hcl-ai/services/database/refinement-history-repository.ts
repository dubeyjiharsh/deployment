import { nanoid } from "nanoid";
import { getDatabase } from "./client";

export interface RefinementHistory {
  id: string;
  canvasId: string;
  fieldKey: string;
  fieldLabel: string;
  beforeValue: string;
  afterValue: string;
  instruction: string;
  industry?: string;
  createdAt: string;
}

/**
 * Save a refinement to history
 */
export async function saveRefinement(refinement: Omit<RefinementHistory, "id" | "createdAt">): Promise<RefinementHistory> {
  const db = await getDatabase();
  const id = nanoid();
  const createdAt = new Date().toISOString();

  await db.execute(
    `INSERT INTO refinement_history (
      id, canvas_id, field_key, field_label, before_value, after_value, instruction, industry, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      refinement.canvasId,
      refinement.fieldKey,
      refinement.fieldLabel,
      refinement.beforeValue,
      refinement.afterValue,
      refinement.instruction,
      refinement.industry || null,
      createdAt
    ]
  );

  return {
    id,
    ...refinement,
    createdAt,
  };
}

/**
 * Get refinement history for a canvas
 */
export async function getRefinementsByCanvas(canvasId: string): Promise<RefinementHistory[]> {
  const db = await getDatabase();
  return await db.query(
    `SELECT
      id,
      canvas_id as canvasId,
      field_key as fieldKey,
      field_label as fieldLabel,
      before_value as beforeValue,
      after_value as afterValue,
      instruction,
      industry,
      created_at as createdAt
    FROM refinement_history
    WHERE canvas_id = $1
    ORDER BY created_at DESC`,
    [canvasId]
  ) as RefinementHistory[];
}

/**
 * Get refinement patterns for a specific field
 */
export async function getRefinementPatternsByField(fieldKey: string, limit: number = 10): Promise<RefinementHistory[]> {
  const db = await getDatabase();
  return await db.query(
    `SELECT
      id,
      canvas_id as canvasId,
      field_key as fieldKey,
      field_label as fieldLabel,
      before_value as beforeValue,
      after_value as afterValue,
      instruction,
      industry,
      created_at as createdAt
    FROM refinement_history
    WHERE field_key = $1
    ORDER BY created_at DESC
    LIMIT $2`,
    [fieldKey, limit]
  ) as RefinementHistory[];
}

/**
 * Get common refinement instructions across all canvases
 */
export async function getCommonRefinementInstructions(limit: number = 10): Promise<Array<{ instruction: string; count: number }>> {
  const db = await getDatabase();
  return await db.query(
    `SELECT instruction, COUNT(*) as count
     FROM refinement_history
     GROUP BY instruction
     ORDER BY count DESC
     LIMIT $1`,
    [limit]
  ) as Array<{ instruction: string; count: number }>;
}

/**
 * Get refinement statistics
 */
export async function getRefinementStats(): Promise<{
  totalRefinements: number;
  uniqueCanvases: number;
  mostRefinedField: { fieldKey: string; fieldLabel: string; count: number } | null;
  recentRefinements: number;
}> {
  const db = await getDatabase();

  const totalResult = await db.queryOne(`SELECT COUNT(*) as total FROM refinement_history`);
  const total = (totalResult as { total: number }).total;

  const canvasesResult = await db.queryOne(`SELECT COUNT(DISTINCT canvas_id) as count FROM refinement_history`);
  const uniqueCanvases = (canvasesResult as { count: number }).count;

  const mostRefinedField = await db.queryOne(
    `SELECT field_key as fieldKey, field_label as fieldLabel, COUNT(*) as count
     FROM refinement_history
     GROUP BY field_key
     ORDER BY count DESC
     LIMIT 1`
  ) as { fieldKey: string; fieldLabel: string; count: number } | undefined;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentResult = await db.queryOne(
    `SELECT COUNT(*) as count
     FROM refinement_history
     WHERE created_at >= $1`,
    [sevenDaysAgo]
  );
  const recentRefinements = (recentResult as { count: number }).count;

  return {
    totalRefinements: total,
    uniqueCanvases,
    mostRefinedField: mostRefinedField || null,
    recentRefinements,
  };
}

/**
 * Get learning insights for suggestions
 */
export async function getLearningInsights(fieldKey?: string): Promise<{
  commonInstructions: Array<{ instruction: string; count: number }>;
  fieldPatterns: RefinementHistory[];
  stats: Awaited<ReturnType<typeof getRefinementStats>>;
}> {
  const commonInstructions = await getCommonRefinementInstructions(5);
  const fieldPatterns = fieldKey ? await getRefinementPatternsByField(fieldKey, 5) : [];
  const stats = await getRefinementStats();

  return {
    commonInstructions,
    fieldPatterns,
    stats,
  };
}

export const refinementHistoryRepository = {
  saveRefinement,
  getRefinementsByCanvas,
  getRefinementPatternsByField,
  getCommonRefinementInstructions,
  getRefinementStats,
  getLearningInsights,
};
