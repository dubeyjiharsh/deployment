import { getDatabase } from "./client";
import type { BusinessCanvas } from "@/lib/validators/canvas-schema";
import { saveCanvasVersion } from "./canvas-versions-repository";

/**
 * Saves a canvas to the database and creates a version snapshot
 */
export async function saveCanvas(canvas: BusinessCanvas, changedBy?: string, changeSummary?: string, ownerId?: string): Promise<void> {
  const db = await getDatabase();

  // If this is a new canvas (INSERT), get the owner_id
  const existingCanvas = await db.queryOne("SELECT owner_id FROM canvases WHERE id = $1", [canvas.id]) as { owner_id: string | null } | undefined;
  const finalOwnerId = existingCanvas?.owner_id || ownerId || changedBy;

  // Save the canvas - use UPSERT syntax that works for both SQLite and PostgreSQL
  // Store document IDs separately for proper cleanup on deletion
  const documentIds = canvas.uploadedFiles ? JSON.stringify(canvas.uploadedFiles) : null;

  await db.execute(`
    INSERT INTO canvases (id, data, created_at, updated_at, status, owner_id, document_ids)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (id) DO UPDATE SET
      data = $2,
      updated_at = $4,
      status = $5,
      owner_id = COALESCE(canvases.owner_id, $6),
      document_ids = $7
  `, [
    canvas.id,
    JSON.stringify(canvas),
    canvas.createdAt,
    canvas.updatedAt,
    canvas.status,
    finalOwnerId,
    documentIds
  ]);

  // Create a version snapshot
  await saveCanvasVersion(canvas, changedBy, changeSummary);
}

/**
 * Gets a canvas by ID
 */
export async function getCanvasById(id: string): Promise<BusinessCanvas | null> {
  const db = await getDatabase();

  const row = await db.queryOne("SELECT data FROM canvases WHERE id = $1", [id]) as { data: string } | undefined;

  if (!row) return null;

  return JSON.parse(row.data) as BusinessCanvas;
}

/**
 * Gets canvas owner ID (without fetching full canvas)
 */
export async function getCanvasOwnerId(id: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.queryOne(
    "SELECT owner_id FROM canvases WHERE id = $1",
    [id]
  ) as { owner_id: string | null } | undefined;

  return row?.owner_id || null;
}

/**
 * Gets all canvases (admin only - returns ALL canvases)
 */
export async function getAllCanvases(): Promise<BusinessCanvas[]> {
  const db = await getDatabase();

  const rows = await db.query("SELECT data FROM canvases ORDER BY updated_at DESC") as { data: string }[];

  return rows.map((row) => JSON.parse(row.data) as BusinessCanvas);
}

/**
 * Canvas with owner information
 */
export interface CanvasWithOwner extends BusinessCanvas {
  ownerName?: string;
  ownerEmail?: string;
  isOwned?: boolean;
  sharedRole?: "owner" | "editor" | "viewer";
}

/**
 * Gets all canvases with owner information (admin only)
 */
export async function getAllCanvasesWithOwner(currentUserId?: string): Promise<CanvasWithOwner[]> {
  const db = await getDatabase();

  const rows = await db.query(`
    SELECT c.data, c.owner_id, u.name as owner_name, u.email as owner_email
    FROM canvases c
    LEFT JOIN users u ON c.owner_id = u.id
    ORDER BY c.updated_at DESC
  `) as Array<{ data: string; owner_id: string | null; owner_name: string | null; owner_email: string | null }>;

  return rows.map((row) => ({
    ...JSON.parse(row.data) as BusinessCanvas,
    ownerName: row.owner_name || undefined,
    ownerEmail: row.owner_email || undefined,
    isOwned: currentUserId ? row.owner_id === currentUserId : true,
  }));
}

/**
 * Gets canvases accessible by a specific user with owner information
 */
export async function getCanvasesByUserWithOwner(userId: string): Promise<CanvasWithOwner[]> {
  const db = await getDatabase();

  const rows = await db.query(`
    SELECT DISTINCT c.data, c.updated_at as "updatedAtRow", u.name as owner_name, u.email as owner_email, c.owner_id, p.role as shared_role
    FROM canvases c
    LEFT JOIN canvas_permissions p ON c.id = p.canvas_id AND p.user_id = $2
    LEFT JOIN users u ON c.owner_id = u.id
    WHERE c.owner_id = $1 OR p.user_id = $2
    ORDER BY c.updated_at DESC
  `, [userId, userId]) as Array<{ data: string; updatedAtRow: string; owner_name: string | null; owner_email: string | null; owner_id: string | null; shared_role: string | null }>;

  return rows.map((row) => ({
    ...JSON.parse(row.data) as BusinessCanvas,
    ownerName: row.owner_name || undefined,
    ownerEmail: row.owner_email || undefined,
    isOwned: row.owner_id === userId,
    sharedRole: row.shared_role as "owner" | "editor" | "viewer" | undefined,
  }));
}

/**
 * Gets canvases accessible by a specific user (owned or shared with them)
 */
export async function getCanvasesByUser(userId: string): Promise<BusinessCanvas[]> {
  const db = await getDatabase();

  const rows = await db.query(`
    SELECT DISTINCT c.data, c.updated_at as "updatedAtRow"
    FROM canvases c
    LEFT JOIN canvas_permissions p ON c.id = p.canvas_id
    WHERE c.owner_id = $1 OR p.user_id = $2
    ORDER BY c.updated_at DESC
  `, [userId, userId]) as { data: string; updatedAtRow: string }[];

  return rows.map((row) => JSON.parse(row.data) as BusinessCanvas);
}

/**
 * Checks if a user has access to a canvas
 */
export async function canUserAccessCanvas(canvasId: string, userId: string): Promise<boolean> {
  const db = await getDatabase();

  const result = await db.queryOne(`
    SELECT COUNT(*) as count
    FROM canvases c
    LEFT JOIN canvas_permissions p ON c.id = p.canvas_id
    WHERE c.id = $1 AND (c.owner_id = $2 OR p.user_id = $3)
  `, [canvasId, userId, userId]) as { count: number };

  return result.count > 0;
}

/**
 * Gets canvases by status
 */
export async function getCanvasesByStatus(
  status: BusinessCanvas["status"]
): Promise<BusinessCanvas[]> {
  const db = await getDatabase();

  const rows = await db.query(
    "SELECT data FROM canvases WHERE status = $1 ORDER BY updated_at DESC",
    [status]
  ) as { data: string }[];

  return rows.map((row) => JSON.parse(row.data) as BusinessCanvas);
}

/**
 * Deletes a canvas and all related data
 */
export async function deleteCanvas(id: string): Promise<void> {
  const db = await getDatabase();

  // Get document IDs before deleting canvas
  const canvasRow = await db.queryOne("SELECT document_ids FROM canvases WHERE id = $1", [id]) as { document_ids: string | null } | undefined;

  // Delete all related records first to avoid foreign key constraint errors
  // Even though some tables have ON DELETE CASCADE, we delete explicitly for safety

  // Delete chat messages
  await db.execute("DELETE FROM chat_messages WHERE canvas_id = $1", [id]);

  // Delete uploaded files
  await db.execute("DELETE FROM uploaded_files WHERE canvas_id = $1", [id]);

  // Delete canvas versions
  await db.execute("DELETE FROM canvas_versions WHERE canvas_id = $1", [id]);

  // Delete comments
  await db.execute("DELETE FROM canvas_comments WHERE canvas_id = $1", [id]);

  // Delete conflicts
  await db.execute("DELETE FROM canvas_conflicts WHERE canvas_id = $1", [id]);

  // Delete permissions (has CASCADE but delete explicitly)
  await db.execute("DELETE FROM canvas_permissions WHERE canvas_id = $1", [id]);

  // Delete refinement history (has CASCADE but delete explicitly if table exists in this DB)
  try {
    await db.execute("DELETE FROM refinement_history WHERE canvas_id = $1", [id]);
  } catch {
    // Table might not exist in this database file
  }

  // Delete document chunks (RAG embeddings) if PostgreSQL is available
  if (canvasRow?.document_ids) {
    try {
      const documentIds: string[] = JSON.parse(canvasRow.document_ids);

      // Only delete if we have document IDs and PostgreSQL is available
      const databaseUrl = process.env.DATABASE_URL;
      if (databaseUrl && documentIds.length > 0) {
        const { deleteDocumentChunks } = await import("@/services/rag/embedding-service");

        // Delete chunks for each document
        for (const documentId of documentIds) {
          await deleteDocumentChunks(documentId);
        }

        console.log(`🗑️  Deleted RAG chunks for ${documentIds.length} document(s)`);
      }
    } catch (error) {
      console.error("Error deleting document chunks:", error);
      // Continue with canvas deletion even if chunk deletion fails
    }
  }

  // Finally, delete the canvas itself
  await db.execute("DELETE FROM canvases WHERE id = $1", [id]);
}

/**
 * Updates canvas status
 */
export async function updateCanvasStatus(
  id: string,
  status: BusinessCanvas["status"]
): Promise<void> {
  const db = await getDatabase();

  await db.execute(`
    UPDATE canvases
    SET status = $1, updated_at = $2
    WHERE id = $3
  `, [status, new Date().toISOString(), id]);
}
