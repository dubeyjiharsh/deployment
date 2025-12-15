import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { getDatabase } from "./client";
import { validatePassword } from "@/lib/password-validation";

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: string;
  teamId: string | null;
  mustChangePassword: boolean;
  sessionsInvalidBefore: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomField {
  id: string;
  name: string;
  instructions: string;
  enabled: boolean;
  valueType?: string;  // "string", "array", "object"
  displayStyle?: string;  // "auto", "paragraph", "bullets", "numbered", "comma", "table"
}

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  customFields?: CustomField[];
  createdAt: string;
  updatedAt: string;
}

export interface CanvasPermission {
  id: string;
  canvasId: string;
  userId: string;
  role: "owner" | "editor" | "viewer";
  createdAt: string;
}


/**
 * Create a new user
 */
export async function createUser(user: {
  email: string;
  name: string;
  password: string;
  role?: string;
  teamId?: string | null;
  mustChangePassword?: boolean;
}): Promise<User> {
  // Validate password
  const validation = validatePassword(user.password);
  if (!validation.isValid) {
    throw new Error(`Password validation failed: ${validation.errors.join(", ")}`);
  }

  const db = await getDatabase();
  const id = nanoid();
  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync(user.password, 10);
  const mustChangePassword = user.mustChangePassword ?? false;

  const role = (user.role || "user").toLowerCase();

  await db.execute(
    `INSERT INTO users (id, email, name, password_hash, role, team_id, must_change_password, sessions_invalid_before, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      user.email.toLowerCase(),
      user.name,
      passwordHash,
      role,
      user.teamId || null,
      mustChangePassword ? 1 : 0, // SQLite requires integer for boolean
      null, // sessions_invalid_before
      now,
      now
    ]
  );

  return {
    id,
    email: user.email.toLowerCase(),
    name: user.name,
    passwordHash,
    role,
    teamId: user.teamId || null,
    mustChangePassword,
    sessionsInvalidBefore: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const db = await getDatabase();
  const row = await db.queryOne(
    `SELECT
      id,
      email,
      name,
      password_hash as "passwordHash",
      role,
      team_id as "teamId",
      COALESCE(must_change_password, false) as "mustChangePassword",
      sessions_invalid_before as "sessionsInvalidBefore",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM users
    WHERE email = $1`,
    [email.toLowerCase()]
  ) as any;

  if (!row) return null;

  return {
    ...row,
    role: typeof row.role === "string" ? row.role.toLowerCase() : row.role,
    // Handle both PostgreSQL (boolean) and SQLite (integer) formats
    mustChangePassword: row.mustChangePassword === true || row.mustChangePassword === 1,
  };
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
  const db = await getDatabase();
  const row = await db.queryOne(
    `SELECT
      id,
      email,
      name,
      password_hash as "passwordHash",
      role,
      team_id as "teamId",
      COALESCE(must_change_password, false) as "mustChangePassword",
      sessions_invalid_before as "sessionsInvalidBefore",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM users
    WHERE id = $1`,
    [id]
  ) as any;

  if (!row) return null;

  return {
    ...row,
    role: typeof row.role === "string" ? row.role.toLowerCase() : row.role,
    // Handle both PostgreSQL (boolean) and SQLite (integer) formats
    mustChangePassword: row.mustChangePassword === true || row.mustChangePassword === 1,
  };
}

/**
 * Verify user password
 */
export function verifyPassword(password: string, passwordHash: string): boolean {
  return bcrypt.compareSync(password, passwordHash);
}

/**
 * Update user password
 * SECURITY: Invalidates all existing sessions when password changes
 */
export async function updateUserPassword(userId: string, newPassword: string): Promise<boolean> {
  // Validate password
  const validation = validatePassword(newPassword);
  if (!validation.isValid) {
    throw new Error(`Password validation failed: ${validation.errors.join(", ")}`);
  }

  const db = await getDatabase();
  const passwordHash = bcrypt.hashSync(newPassword, 10);
  const now = new Date().toISOString();

  // Set sessions_invalid_before to now to invalidate all existing sessions
  await db.execute(
    `UPDATE users
     SET password_hash = $1, must_change_password = false, sessions_invalid_before = $2, updated_at = $3
     WHERE id = $4`,
    [passwordHash, now, now, userId]
  );

  console.log(`[Security] Password changed for user ${userId} - all sessions invalidated`);

  return true;
}

/**
 * Clear session invalidation flag for a user
 * Called after successful login with new password to stop invalidating future sessions
 */
export async function clearSessionInvalidation(userId: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.execute(
    `UPDATE users
     SET sessions_invalid_before = NULL, updated_at = $1
     WHERE id = $2`,
    [now, userId]
  );

  console.log(`[Security] Cleared session invalidation for user ${userId}`);
}

/**
 * Update user details
 * Note: Field names are explicitly whitelisted to prevent SQL injection
 */
export async function updateUser(
  userId: string,
  updates: { name?: string; email?: string; teamId?: string | null; role?: string }
): Promise<User | null> {
  const db = await getDatabase();
  const user = await getUserById(userId);
  if (!user) return null;

  const now = new Date().toISOString();

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.email !== undefined) {
    fields.push(`email = $${paramIndex++}`);
    values.push(updates.email.toLowerCase());
  }
  if (updates.teamId !== undefined) {
    fields.push(`team_id = $${paramIndex++}`);
    values.push(updates.teamId);
  }
  if (updates.role !== undefined) {
    fields.push(`role = $${paramIndex++}`);
    values.push(updates.role.toLowerCase());
  }

  if (fields.length === 0) return user;

  fields.push(`updated_at = $${paramIndex++}`);
  values.push(now);
  values.push(userId);

  await db.execute(
    `UPDATE users
     SET ${fields.join(", ")}
     WHERE id = $${paramIndex}`,
    values
  );

  return getUserById(userId);
}

/**
 * Delete user
 */
export async function deleteUser(userId: string): Promise<boolean> {
  const db = await getDatabase();
  await db.execute("DELETE FROM users WHERE id = $1", [userId]);
  return true;
}

/**
 * Get all users
 */
export async function getAllUsers(): Promise<Omit<User, "passwordHash">[]> {
  const db = await getDatabase();
  const rows = await db.query(`
    SELECT
      id,
      email,
      name,
      role,
      team_id as "teamId",
      COALESCE(must_change_password, false) as "mustChangePassword",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM users
    ORDER BY created_at DESC
  `) as any[];

  return rows.map(row => ({
    ...row,
    role: typeof row.role === "string" ? row.role.toLowerCase() : row.role,
    mustChangePassword: row.mustChangePassword === true || row.mustChangePassword === 1,
  }));
}

/**
 * Get users by team
 */
export async function getUsersByTeam(teamId: string): Promise<Omit<User, "passwordHash">[]> {
  const db = await getDatabase();
  const rows = await db.query(
    `SELECT
      id,
      email,
      name,
      role,
      team_id as "teamId",
      COALESCE(must_change_password, false) as "mustChangePassword",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM users
    WHERE team_id = $1
    ORDER BY created_at DESC`,
    [teamId]
  ) as any[];

  return rows.map(row => ({
    ...row,
    role: typeof row.role === "string" ? row.role.toLowerCase() : row.role,
    mustChangePassword: row.mustChangePassword === true || row.mustChangePassword === 1,
  }));
}

/**
 * Create a new team
 */
export async function createTeam(name: string, ownerId: string, customFields?: CustomField[]): Promise<Team> {
  const db = await getDatabase();
  const id = nanoid();
  const now = new Date().toISOString();

  const customFieldsJson = customFields ? JSON.stringify(customFields) : null;

  await db.execute(
    `INSERT INTO teams (id, name, owner_id, custom_fields, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, name, ownerId, customFieldsJson, now, now]
  );

  return {
    id,
    name,
    ownerId,
    customFields,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get team by ID
 */
export async function getTeamById(id: string): Promise<Team | null> {
  const db = await getDatabase();
  const row = await db.queryOne(
    `SELECT
      id,
      name,
      owner_id as "ownerId",
      custom_fields as "customFieldsJson",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM teams
    WHERE id = $1`,
    [id]
  ) as any;

  if (!row) return null;

  return {
    ...row,
    customFields: row.customFieldsJson ? JSON.parse(row.customFieldsJson) : undefined,
    customFieldsJson: undefined, // Remove the raw JSON field
  };
}

/**
 * Get all teams
 */
export async function getAllTeams(): Promise<Team[]> {
  const db = await getDatabase();
  const rows = await db.query(`
    SELECT
      id,
      name,
      owner_id as "ownerId",
      custom_fields as "customFieldsJson",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM teams
    ORDER BY created_at DESC
  `) as any[];

  return rows.map(row => ({
    ...row,
    customFields: row.customFieldsJson ? JSON.parse(row.customFieldsJson) : undefined,
    customFieldsJson: undefined, // Remove the raw JSON field
  }));
}

/**
 * Update team
 */
export async function updateTeam(teamId: string, name: string, customFields?: CustomField[]): Promise<Team | null> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const customFieldsJson = customFields !== undefined ? JSON.stringify(customFields) : undefined;

  if (customFieldsJson !== undefined) {
    await db.execute(
      `UPDATE teams
       SET name = $1, custom_fields = $2, updated_at = $3
       WHERE id = $4`,
      [name, customFieldsJson, now, teamId]
    );
  } else {
    await db.execute(
      `UPDATE teams
       SET name = $1, updated_at = $2
       WHERE id = $3`,
      [name, now, teamId]
    );
  }

  return getTeamById(teamId);
}

/**
 * Delete team
 */
export async function deleteTeam(teamId: string): Promise<boolean> {
  const db = await getDatabase();
  // Remove team_id from all users in this team
  await db.execute("UPDATE users SET team_id = NULL WHERE team_id = $1", [teamId]);

  await db.execute("DELETE FROM teams WHERE id = $1", [teamId]);
  return true;
}

/**
 * Grant canvas permission to user
 */
export async function grantCanvasPermission(
  canvasId: string,
  userId: string,
  role: "owner" | "editor" | "viewer"
): Promise<CanvasPermission> {
  const db = await getDatabase();
  const id = nanoid();
  const now = new Date().toISOString();

  // Use INSERT ... ON CONFLICT for PostgreSQL compatibility
  await db.execute(
    `INSERT INTO canvas_permissions (id, canvas_id, user_id, role, created_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (canvas_id, user_id)
     DO UPDATE SET role = $4, id = $1, created_at = $5`,
    [id, canvasId, userId, role, now]
  );

  return {
    id,
    canvasId,
    userId,
    role,
    createdAt: now,
  };
}

/**
 * Revoke canvas permission
 */
export async function revokeCanvasPermission(canvasId: string, userId: string): Promise<boolean> {
  const db = await getDatabase();
  await db.execute(
    `DELETE FROM canvas_permissions
     WHERE canvas_id = $1 AND user_id = $2`,
    [canvasId, userId]
  );

  return true;
}

/**
 * Get canvas permissions
 */
export async function getCanvasPermissions(canvasId: string): Promise<CanvasPermission[]> {
  const db = await getDatabase();
  return await db.query(
    `SELECT
      id,
      canvas_id as "canvasId",
      user_id as "userId",
      role,
      created_at as "createdAt"
    FROM canvas_permissions
    WHERE canvas_id = $1`,
    [canvasId]
  ) as CanvasPermission[];
}

/**
 * Get user's canvas permission
 */
export async function getUserCanvasPermission(
  canvasId: string,
  userId: string
): Promise<CanvasPermission | null> {
  const db = await getDatabase();
  return await db.queryOne(
    `SELECT
      id,
      canvas_id as "canvasId",
      user_id as "userId",
      role,
      created_at as "createdAt"
    FROM canvas_permissions
    WHERE canvas_id = $1 AND user_id = $2`,
    [canvasId, userId]
  ) as CanvasPermission | null;
}

/**
 * Get canvases accessible to user
 */
export async function getUserAccessibleCanvases(userId: string): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.query(
    `SELECT DISTINCT canvas_id as canvasId
     FROM canvas_permissions
     WHERE user_id = $1`,
    [userId]
  ) as Array<{ canvasId: string }>;

  return rows.map((row) => row.canvasId);
}

/**
 * Check if user has permission to access canvas
 * Checks both canvas ownership (owner_id in canvases table) and explicit permissions
 */
export async function canUserAccessCanvas(
  canvasId: string,
  userId: string,
  requiredRole?: "owner" | "editor" | "viewer"
): Promise<boolean> {
  const db = await getDatabase();

  // First check if user is the owner of the canvas
  const canvas = await db.queryOne(
    "SELECT owner_id FROM canvases WHERE id = $1",
    [canvasId]
  ) as { owner_id: string | null } | undefined;
  const isOwner = canvas?.owner_id === userId;

  if (isOwner) {
    // Canvas owners have all permissions
    return true;
  }

  // Check explicit permissions in canvas_permissions table
  const permission = await getUserCanvasPermission(canvasId, userId);
  if (!permission) return false;

  if (!requiredRole) return true;

  // Permission hierarchy: owner > editor > viewer
  const roleHierarchy = { owner: 3, editor: 2, viewer: 1 };
  return roleHierarchy[permission.role] >= roleHierarchy[requiredRole];
}

export const userRepository = {
  createUser,
  getUserByEmail,
  getUserById,
  verifyPassword,
  updateUserPassword,
  clearSessionInvalidation,
  updateUser,
  deleteUser,
  getAllUsers,
  getUsersByTeam,
  createTeam,
  getTeamById,
  getAllTeams,
  updateTeam,
  deleteTeam,
  grantCanvasPermission,
  revokeCanvasPermission,
  getCanvasPermissions,
  getUserCanvasPermission,
  getUserAccessibleCanvases,
  canUserAccessCanvas,
};
