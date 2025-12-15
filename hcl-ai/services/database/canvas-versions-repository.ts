import { getDatabase } from "./client";
import type { BusinessCanvas } from "@/lib/validators/canvas-schema";
import { nanoid } from "nanoid";

export interface CanvasVersion {
  id: string;
  canvasId: string;
  versionNumber: number;
  data: BusinessCanvas;
  changedBy?: string;
  changeSummary?: string;
  createdAt: string;
}

/**
 * Save a new version of a canvas
 */
export async function saveCanvasVersion(
  canvas: BusinessCanvas,
  changedBy?: string,
  changeSummary?: string
): Promise<CanvasVersion> {
  const db = await getDatabase();

  // Get the latest version number for this canvas
  const latestVersion = await db.queryOne(
    "SELECT MAX(version_number) as max_version FROM canvas_versions WHERE canvas_id = $1",
    [canvas.id]
  ) as { max_version: number | null };
  const versionNumber = (latestVersion.max_version || 0) + 1;

  const version: CanvasVersion = {
    id: nanoid(),
    canvasId: canvas.id,
    versionNumber,
    data: canvas,
    changedBy,
    changeSummary,
    createdAt: new Date().toISOString(),
  };

  await db.execute(
    `INSERT INTO canvas_versions (id, canvas_id, version_number, data, changed_by, change_summary, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      version.id,
      version.canvasId,
      version.versionNumber,
      JSON.stringify(version.data),
      version.changedBy,
      version.changeSummary,
      version.createdAt
    ]
  );

  return version;
}

/**
 * Get all versions for a canvas
 */
export async function getCanvasVersions(canvasId: string): Promise<CanvasVersion[]> {
  const db = await getDatabase();

  const rows = await db.query(
    `SELECT * FROM canvas_versions
     WHERE canvas_id = $1
     ORDER BY version_number DESC`,
    [canvasId]
  ) as Array<{
    id: string;
    canvas_id: string;
    version_number: number;
    data: string;
    changed_by: string | null;
    change_summary: string | null;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    canvasId: row.canvas_id,
    versionNumber: row.version_number,
    data: JSON.parse(row.data) as BusinessCanvas,
    changedBy: row.changed_by || undefined,
    changeSummary: row.change_summary || undefined,
    createdAt: row.created_at,
  }));
}

/**
 * Get a specific version
 */
export async function getCanvasVersion(versionId: string): Promise<CanvasVersion | null> {
  const db = await getDatabase();

  const row = await db.queryOne(
    "SELECT * FROM canvas_versions WHERE id = $1",
    [versionId]
  ) as {
    id: string;
    canvas_id: string;
    version_number: number;
    data: string;
    changed_by: string | null;
    change_summary: string | null;
    created_at: string;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    canvasId: row.canvas_id,
    versionNumber: row.version_number,
    data: JSON.parse(row.data) as BusinessCanvas,
    changedBy: row.changed_by || undefined,
    changeSummary: row.change_summary || undefined,
    createdAt: row.created_at,
  };
}

/**
 * Get latest version number for a canvas
 */
export async function getLatestVersionNumber(canvasId: string): Promise<number> {
  const db = await getDatabase();

  const result = await db.queryOne(
    "SELECT MAX(version_number) as max_version FROM canvas_versions WHERE canvas_id = $1",
    [canvasId]
  ) as { max_version: number | null };

  return result.max_version || 0;
}
