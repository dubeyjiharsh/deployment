import { getDatabase } from "./client";
import type { McpServerConfig } from "@/lib/validators/canvas-schema";

/**
 * Saves an MCP server configuration
 */
export async function saveMcpServer(server: McpServerConfig): Promise<void> {
  const db = await getDatabase();

  // Use INSERT ... ON CONFLICT for PostgreSQL compatibility
  await db.execute(
    `INSERT INTO mcp_servers (id, name, type, config, enabled, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id)
     DO UPDATE SET name = $2, type = $3, config = $4, enabled = $5, created_at = $6`,
    [
      server.id,
      server.name,
      server.type,
      JSON.stringify(server.config),
      server.enabled,
      server.createdAt
    ]
  );
}

/**
 * Gets all MCP server configurations
 */
export async function getAllMcpServers(): Promise<McpServerConfig[]> {
  const db = await getDatabase();

  const rows = await db.query(
    "SELECT * FROM mcp_servers ORDER BY created_at DESC"
  ) as Array<{
    id: string;
    name: string;
    type: string;
    config: string;
    enabled: number | boolean;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type as "stdio", // Type assertion since DB stores as string but schema requires literal
    config: JSON.parse(row.config),
    enabled: row.enabled === true || row.enabled === 1,
    createdAt: row.created_at,
  }));
}

/**
 * Gets enabled MCP servers
 */
export async function getEnabledMcpServers(): Promise<McpServerConfig[]> {
  const db = await getDatabase();

  const rows = await db.query(
    "SELECT * FROM mcp_servers WHERE enabled = $1 ORDER BY created_at DESC",
    [1] // SQLite uses 1 for true, 0 for false
  ) as Array<{
    id: string;
    name: string;
    type: string;
    config: string;
    enabled: number | boolean;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type as "stdio", // Type assertion since DB stores as string but schema requires literal
    config: JSON.parse(row.config),
    enabled: row.enabled === true || row.enabled === 1,
    createdAt: row.created_at,
  }));
}

/**
 * Deletes an MCP server configuration
 */
export async function deleteMcpServer(id: string): Promise<void> {
  const db = await getDatabase();

  await db.execute("DELETE FROM mcp_servers WHERE id = $1", [id]);
}

/**
 * Toggles an MCP server's enabled status
 */
export async function toggleMcpServer(id: string): Promise<void> {
  const db = await getDatabase();

  await db.execute(
    `UPDATE mcp_servers
     SET enabled = NOT enabled
     WHERE id = $1`,
    [id]
  );
}
