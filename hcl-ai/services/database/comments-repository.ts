import { getDatabase } from "./client";
import { nanoid } from "nanoid";

export interface Comment {
  id: string;
  canvasId: string;
  fieldKey: string;
  content: string;
  authorId: string;
  author: string; // Display name/email
  authorEmail?: string;
  parentId: string | null; // For threaded replies
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create a new comment
 */
export async function createComment(comment: {
  canvasId: string;
  fieldKey: string;
  content: string;
  userId: string;
  authorName?: string;
  authorEmail?: string;
  parentId: string | null;
  resolved: boolean;
}): Promise<Comment> {
  const db = await getDatabase();
  const id = nanoid();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO canvas_comments (
      id, canvas_id, field_key, user_id, parent_id, content, resolved, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      comment.canvasId,
      comment.fieldKey,
      comment.userId,
      comment.parentId || null,
      comment.content,
      comment.resolved ? 1 : 0,
      now,
      now
    ]
  );

  return {
    id,
    canvasId: comment.canvasId,
    fieldKey: comment.fieldKey,
    content: comment.content,
    authorId: comment.userId,
    author: comment.authorName || comment.authorEmail || comment.userId,
    authorEmail: comment.authorEmail,
    parentId: comment.parentId,
    resolved: comment.resolved,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get all comments for a canvas
 */
export async function getCommentsByCanvas(canvasId: string): Promise<Comment[]> {
  const db = await getDatabase();
  const rows = await db.query(
    `SELECT
      cc.id,
      canvas_id as canvasId,
      field_key as fieldKey,
      content,
      user_id as authorId,
      u.name as authorName,
      u.email as authorEmail,
      parent_id as parentId,
      resolved,
      created_at as createdAt,
      updated_at as updatedAt
    FROM canvas_comments cc
    LEFT JOIN users u ON cc.user_id = u.id
    WHERE canvas_id = $1
    ORDER BY created_at ASC`,
    [canvasId]
  ) as Array<Omit<Comment, "resolved" | "parentId" | "author"> & { authorName: string | null; authorEmail: string | null; resolved: number | boolean; parentId: string | null }>;

  return rows.map((row) => ({
    ...row,
    author: row.authorName || row.authorEmail || row.authorId,
    authorEmail: row.authorEmail || undefined,
    parentId: row.parentId || null,
    resolved: row.resolved === true || row.resolved === 1,
  }));
}

/**
 * Get comments for a specific field
 */
export async function getCommentsByField(canvasId: string, fieldKey: string): Promise<Comment[]> {
  const db = await getDatabase();
  const rows = await db.query(
    `SELECT
      cc.id,
      canvas_id as canvasId,
      field_key as fieldKey,
      content,
      user_id as authorId,
      u.name as authorName,
      u.email as authorEmail,
      parent_id as parentId,
      resolved,
      created_at as createdAt,
      updated_at as updatedAt
    FROM canvas_comments cc
    LEFT JOIN users u ON cc.user_id = u.id
    WHERE canvas_id = $1 AND field_key = $2
    ORDER BY created_at ASC`,
    [canvasId, fieldKey]
  ) as Array<Omit<Comment, "resolved" | "parentId" | "author"> & { authorName: string | null; authorEmail: string | null; resolved: number | boolean; parentId: string | null }>;

  return rows.map((row) => ({
    ...row,
    author: row.authorName || row.authorEmail || row.authorId,
    authorEmail: row.authorEmail || undefined,
    parentId: row.parentId || null,
    resolved: row.resolved === true || row.resolved === 1,
  }));
}

/**
 * Get comment by ID
 */
export async function getCommentById(id: string): Promise<Comment | null> {
  const db = await getDatabase();
  const row = await db.queryOne(
    `SELECT
      cc.id,
      canvas_id as canvasId,
      field_key as fieldKey,
      content,
      user_id as authorId,
      u.name as authorName,
      u.email as authorEmail,
      parent_id as parentId,
      resolved,
      created_at as createdAt,
      updated_at as updatedAt
    FROM canvas_comments cc
    LEFT JOIN users u ON cc.user_id = u.id
    WHERE cc.id = $1`,
    [id]
  ) as (Omit<Comment, "resolved" | "parentId" | "author"> & { authorName: string | null; authorEmail: string | null; resolved: number | boolean; parentId: string | null }) | undefined;

  if (!row) return null;

  return {
    ...row,
    author: row.authorName || row.authorEmail || row.authorId,
    authorEmail: row.authorEmail || undefined,
    parentId: row.parentId || null,
    resolved: row.resolved === true || row.resolved === 1,
  };
}

/**
 * Update comment content
 */
export async function updateComment(id: string, content: string): Promise<Comment | null> {
  const db = await getDatabase();
  const comment = await getCommentById(id);
  if (!comment) return null;

  const now = new Date().toISOString();

  await db.execute(
    `UPDATE canvas_comments
     SET content = $1, updated_at = $2
     WHERE id = $3`,
    [content, now, id]
  );

  return {
    ...comment,
    content,
    updatedAt: now,
  };
}

/**
 * Mark comment as resolved/unresolved
 */
export async function setCommentResolved(id: string, resolved: boolean): Promise<Comment | null> {
  const db = await getDatabase();
  const comment = await getCommentById(id);
  if (!comment) return null;

  const now = new Date().toISOString();

  await db.execute(
    `UPDATE canvas_comments
     SET resolved = $1, updated_at = $2
     WHERE id = $3`,
    [resolved ? 1 : 0, now, id]
  );

  return {
    ...comment,
    resolved,
    updatedAt: now,
  };
}

/**
 * Delete a comment
 */
export async function deleteComment(id: string): Promise<boolean> {
  const db = await getDatabase();
  await db.execute(
    `DELETE FROM canvas_comments
     WHERE id = $1`,
    [id]
  );

  return true;
}

/**
 * Get comment count by field
 */
export async function getCommentCountByField(canvasId: string): Promise<Record<string, number>> {
  const db = await getDatabase();
  const unresolvedValue = 0; // SQLite-friendly false
  const rows = await db.query(
    `SELECT field_key as fieldKey, COUNT(*) as count
     FROM canvas_comments
     WHERE canvas_id = $1 AND resolved = $2
     GROUP BY field_key`,
    [canvasId, unresolvedValue]
  ) as Array<{ fieldKey: string; count: number }>;

  return rows.reduce((acc, row) => {
    acc[row.fieldKey] = row.count;
    return acc;
  }, {} as Record<string, number>);
}

export const commentsRepository = {
  createComment,
  getCommentsByCanvas,
  getCommentsByField,
  getCommentById,
  updateComment,
  setCommentResolved,
  deleteComment,
  getCommentCountByField,
};
