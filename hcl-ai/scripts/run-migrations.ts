#!/usr/bin/env tsx
/**
 * Database migration runner
 * Runs all pending migrations in order
 * Works with both SQLite (local) and PostgreSQL (production)
 */

import { getDatabase } from '../services/database/client';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

async function runMigrations() {
  const db = await getDatabase();

  console.log('[MIGRATIONS] Starting database migrations...');

  // Create migrations table if it doesn't exist
  const createMigrationsTable = `
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `;

  await db.execute(createMigrationsTable);
  console.log('[MIGRATIONS] Migrations table ready');

  // Get list of migration files
  const migrationsDir = join(process.cwd(), 'migrations');
  const migrationFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`[MIGRATIONS] Found ${migrationFiles.length} migration files`);

  // Get already applied migrations
  const appliedMigrations = await db.query(
    'SELECT name FROM migrations'
  ) as Array<{ name: string }>;

  const appliedSet = new Set(appliedMigrations.map(m => m.name));

  // Run pending migrations
  let appliedCount = 0;
  for (const file of migrationFiles) {
    if (appliedSet.has(file)) {
      console.log(`[MIGRATIONS] ✓ ${file} (already applied)`);
      continue;
    }

    console.log(`[MIGRATIONS] Running ${file}...`);
    const migrationPath = join(migrationsDir, file);
    const sql = readFileSync(migrationPath, 'utf-8');

    try {
      // For PostgreSQL DO blocks, execute as-is
      // For SQLite, we need to handle it differently
      const isPostgres = process.env.DATABASE_URL?.includes('postgres');

      if (isPostgres) {
        // PostgreSQL: Execute the DO block directly
        await db.execute(sql);
      } else {
        // SQLite: Extract and run the ALTER TABLE command
        // Skip DO blocks entirely for SQLite
        if (!sql.includes('DO $$')) {
          await db.execute(sql);
        } else {
          // Parse out the ALTER TABLE from the DO block
          const alterMatch = sql.match(/ALTER TABLE[\s\S]+?;/);
          if (alterMatch) {
            try {
              await db.execute(alterMatch[0]);
            } catch (error: unknown) {
              // Ignore "duplicate column" errors for SQLite
              const err = error as { message?: string };
              if (!err.message?.includes('duplicate column')) {
                throw error;
              }
              console.log(`[MIGRATIONS] Column already exists, skipping...`);
            }
          }
        }
      }

      // Record migration as applied
      const now = new Date().toISOString();
      await db.execute(
        'INSERT INTO migrations (id, name, applied_at) VALUES ($1, $2, $3)',
        [file, file, now]
      );

      console.log(`[MIGRATIONS] ✓ ${file} applied successfully`);
      appliedCount++;
    } catch (error) {
      console.error(`[MIGRATIONS] ✗ Failed to apply ${file}:`, error);
      throw error;
    }
  }

  if (appliedCount === 0) {
    console.log('[MIGRATIONS] No new migrations to apply');
  } else {
    console.log(`[MIGRATIONS] Successfully applied ${appliedCount} migration(s)`);
  }

  process.exit(0);
}

runMigrations().catch(error => {
  console.error('[MIGRATIONS] Migration failed:', error);
  process.exit(1);
});
