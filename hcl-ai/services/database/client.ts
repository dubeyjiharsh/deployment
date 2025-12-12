import Database from "better-sqlite3";
import { Pool } from "pg";
import path from "path";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { nanoid } from "nanoid";

// Database abstraction layer
export interface DatabaseClient {
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
  queryOne(sql: string, params?: unknown[]): Promise<unknown | undefined>;
  execute(sql: string, params?: unknown[]): Promise<void>;
  close(): void;
}

let dbClient: DatabaseClient | null = null;
let initializationPromise: Promise<void> | null = null;

/**
 * Gets the database client (singleton)
 * Ensures schema initialization and migrations complete before returning
 */
export async function getDatabase(): Promise<DatabaseClient> {
  if (!dbClient) {
    const databaseUrl = process.env.DATABASE_URL;

    if (databaseUrl) {
      // Use PostgreSQL
      dbClient = new PostgresClient(databaseUrl);
      console.log("✅ Connected to PostgreSQL");
    } else {
      // Use SQLite for local development
      dbClient = new SQLiteClient();
      console.log("✅ Connected to SQLite (local development)");
    }

    // Initialize schema, run migrations, and wait for completion
    initializationPromise = (async () => {
      await initializeSchema(dbClient!);
      await runMigrations(dbClient!);
    })();
    await initializationPromise;
  } else if (initializationPromise) {
    // If client exists but initialization might still be in progress, wait for it
    await initializationPromise;
  }

  return dbClient;
}

/**
 * SQLite client wrapper
 */
class SQLiteClient implements DatabaseClient {
  private db: Database.Database;

  constructor() {
    const dbPath = path.join(process.cwd(), "data", "canvas.db");
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
  }

  /**
   * Converts PostgreSQL-style placeholders ($1, $2, etc.) to SQLite-style placeholders (?)
   * and reorders parameters to match the order they appear in the SQL
   */
  private convertPlaceholders(sql: string, params: unknown[]): { sql: string; params: unknown[] } {
    if (params.length === 0) {
      return { sql, params };
    }

    // Find all placeholder numbers in order they appear
    const placeholderMatches = Array.from(sql.matchAll(/\$(\d+)/g));
    
    if (placeholderMatches.length === 0) {
      return { sql, params };
    }

    // Build reordered params array based on placeholder order
    const reorderedParams: unknown[] = [];
    for (const match of placeholderMatches) {
      const index = parseInt(match[1], 10) - 1; // Convert $1 to index 0, $2 to index 1, etc.
      if (index >= 0 && index < params.length) {
        reorderedParams.push(params[index]);
      }
    }

    // Replace all $N with ?
    const convertedSql = sql.replace(/\$(\d+)/g, "?");

    return { sql: convertedSql, params: reorderedParams };
  }

  async query(sql: string, params: unknown[] = []): Promise<unknown[]> {
    const { sql: convertedSql, params: convertedParams } = this.convertPlaceholders(sql, params);
    return this.db.prepare(convertedSql).all(...convertedParams);
  }

  async queryOne(sql: string, params: unknown[] = []): Promise<unknown | undefined> {
    const { sql: convertedSql, params: convertedParams } = this.convertPlaceholders(sql, params);
    return this.db.prepare(convertedSql).get(...convertedParams);
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    if (params.length === 0) {
      this.db.exec(sql);
    } else {
      const { sql: convertedSql, params: convertedParams } = this.convertPlaceholders(sql, params);
      this.db.prepare(convertedSql).run(...convertedParams);
    }
  }

  close(): void {
    this.db.close();
  }
}

/**
 * PostgreSQL client wrapper
 */
class PostgresClient implements DatabaseClient {
  private pool: Pool;

  constructor(connectionString: string) {
    // Determine SSL settings based on environment variable
    // DATABASE_SSL=false explicitly disables SSL (for Docker local DB)
    // DATABASE_SSL=true explicitly enables SSL
    // If not set, defaults to true in production
    const requiresSsl = process.env.DATABASE_SSL === 'false'
      ? false
      : (process.env.DATABASE_SSL === 'true' || process.env.NODE_ENV === 'production');

    this.pool = new Pool({
      connectionString,
      ssl: requiresSsl ? {
        rejectUnauthorized: false
      } : false
    });
  }

  async query(sql: string, params: unknown[] = []): Promise<unknown[]> {
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  async queryOne(sql: string, params: unknown[] = []): Promise<unknown | undefined> {
    const result = await this.pool.query(sql, params);
    return result.rows[0];
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    await this.pool.query(sql, params);
  }

  close(): void {
    this.pool.end();
  }
}

/**
 * Initializes the database schema
 * Executes each CREATE TABLE statement separately to avoid issues with PostgreSQL
 */
async function initializeSchema(database: DatabaseClient): Promise<void> {
  const isPostgres = database instanceof PostgresClient;

  // Convert boolean and text fields based on database type
  const boolType = isPostgres ? "BOOLEAN" : "INTEGER";
  const timestampType = isPostgres ? "TIMESTAMP" : "TEXT";
  const defaultBoolTrue = isPostgres ? "TRUE" : "1";
  const defaultBoolFalse = isPostgres ? "FALSE" : "0";

  // Helper to execute a single CREATE TABLE statement
  const createTable = async (sql: string): Promise<void> => {
    await database.execute(sql);
  };

  // Execute each CREATE TABLE statement separately
  // This is necessary because PostgreSQL's pg library handles multi-statement strings differently than SQLite

  // 1. Create base tables without foreign keys first
  await createTable(`
    CREATE TABLE IF NOT EXISTS canvases (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at ${timestampType} NOT NULL,
      updated_at ${timestampType} NOT NULL,
      status TEXT NOT NULL,
      owner_id TEXT
    )
  `);

  await createTable(`
    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config TEXT NOT NULL,
      enabled ${boolType} NOT NULL DEFAULT ${defaultBoolTrue},
      created_at ${timestampType} NOT NULL
    )
  `);

  await createTable(`
    CREATE TABLE IF NOT EXISTS company_settings (
      id TEXT PRIMARY KEY,
      company_name TEXT,
      industry TEXT,
      company_info TEXT,
      llm_provider TEXT DEFAULT 'claude',
      claude_api_key TEXT,
      openai_api_key TEXT,
      enable_thinking ${boolType} DEFAULT ${defaultBoolFalse},
      canvas_fields TEXT,
      role_definitions TEXT,
      field_availability TEXT,
      created_at ${timestampType} NOT NULL,
      updated_at ${timestampType} NOT NULL
    )
  `);

  await createTable(`
    CREATE TABLE IF NOT EXISTS company_documents (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      content TEXT NOT NULL,
      mime_type TEXT,
      uploaded_at ${timestampType} NOT NULL
    )
  `);

  // 2. Create users table first (without team_id FK due to circular dependency)
  await createTable(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      team_id TEXT,
      must_change_password ${boolType} DEFAULT ${defaultBoolFalse},
      sessions_invalid_before ${timestampType},
      created_at ${timestampType} NOT NULL,
      updated_at ${timestampType} NOT NULL
    )
  `);

  // Add sessions_invalid_before column if it doesn't exist (for existing databases)
  if (isPostgres) {
    try {
      const columnExists = await database.queryOne(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name = 'sessions_invalid_before'
        LIMIT 1
      `);

      if (!columnExists) {
        await database.execute(`
          ALTER TABLE users
          ADD COLUMN sessions_invalid_before ${timestampType}
        `);
        console.log("✅ Added sessions_invalid_before column to users table");
      }
    } catch (error) {
      // Column might already exist
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (!errorMsg.includes('already exists') && !errorMsg.includes('duplicate')) {
        console.log("Note: Could not add sessions_invalid_before column:", errorMsg);
      }
    }
  } else {
    // For SQLite, try to add column if it doesn't exist
    try {
      await database.execute(`
        ALTER TABLE users
        ADD COLUMN sessions_invalid_before ${timestampType}
      `);
      console.log("✅ Added sessions_invalid_before column to users table");
    } catch (error) {
      // Column might already exist, which is fine
      // SQLite will error if the column exists
    }
  }

  // 3. Create teams table (references users)
  await createTable(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      description TEXT,
      custom_fields TEXT,
      created_at ${timestampType} NOT NULL,
      updated_at ${timestampType} NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 4. Add foreign key constraint to users.team_id if it doesn't exist
  // Handle circular dependency: users -> teams -> users
  // We create users first without the FK, then teams, then add the FK to users
  if (isPostgres) {
    try {
      // First check if the constraint already exists
      const constraintExists = await database.queryOne(`
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'users' 
          AND constraint_type = 'FOREIGN KEY'
          AND constraint_name LIKE '%team_id%'
        LIMIT 1
      `);
      
      if (!constraintExists) {
        await database.execute(`
          ALTER TABLE users 
          ADD CONSTRAINT users_team_id_fkey
          FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
        `);
      }
    } catch (error) {
      // Constraint might already exist or there's another issue
      // This is okay - if the constraint exists, referential integrity is maintained
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (!errorMsg.includes('already exists') && !errorMsg.includes('duplicate')) {
        console.log("Note: Could not add users.team_id foreign key constraint:", errorMsg);
      }
    }
  } else {
    // For SQLite, foreign keys are enforced via PRAGMA
    // SQLite doesn't support adding FKs via ALTER TABLE easily
    try {
      await database.execute(`PRAGMA foreign_keys=ON`);
    } catch (error) {
      // Ignore - PRAGMA might fail or not be needed
    }
  }

  // 5. Create tables that reference canvases
  await createTable(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      field_name TEXT,
      timestamp ${timestampType} NOT NULL,
      FOREIGN KEY (canvas_id) REFERENCES canvases (id)
    )
  `);

  await createTable(`
    CREATE TABLE IF NOT EXISTS uploaded_files (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      uploaded_at ${timestampType} NOT NULL,
      FOREIGN KEY (canvas_id) REFERENCES canvases (id)
    )
  `);

  await createTable(`
    CREATE TABLE IF NOT EXISTS canvas_versions (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      data TEXT NOT NULL,
      changed_by TEXT,
      change_summary TEXT,
      created_at ${timestampType} NOT NULL,
      FOREIGN KEY (canvas_id) REFERENCES canvases (id)
    )
  `);

  await createTable(`
    CREATE TABLE IF NOT EXISTS canvas_comments (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL,
      field_key TEXT NOT NULL,
      user_id TEXT NOT NULL,
      parent_id TEXT,
      content TEXT NOT NULL,
      resolved ${boolType} DEFAULT ${defaultBoolFalse},
      created_at ${timestampType} NOT NULL,
      updated_at ${timestampType} NOT NULL,
      FOREIGN KEY (canvas_id) REFERENCES canvases (id),
      FOREIGN KEY (parent_id) REFERENCES canvas_comments (id) ON DELETE SET NULL
    )
  `);
  // Add parent_id column for threaded comments if it doesn't exist (for existing databases)
  if (isPostgres) {
    try {
      const columnExists = await database.queryOne(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'canvas_comments'
          AND column_name = 'parent_id'
        LIMIT 1
      `);

      if (!columnExists) {
        await database.execute(`
          ALTER TABLE canvas_comments
          ADD COLUMN parent_id TEXT
        `);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (!errorMsg.includes("already exists") && !errorMsg.includes("duplicate")) {
        console.log("Note: Could not add parent_id column to canvas_comments:", errorMsg);
      }
    }
  } else {
    try {
      await database.execute(`
        ALTER TABLE canvas_comments
        ADD COLUMN parent_id TEXT
      `);
    } catch {
      // Column already exists or ALTER TABLE not supported, ignore
    }
  }

  await createTable(`
    CREATE TABLE IF NOT EXISTS canvas_permissions (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      team_id TEXT,
      role TEXT NOT NULL DEFAULT 'viewer',
      created_at ${timestampType} NOT NULL,
      FOREIGN KEY (canvas_id) REFERENCES canvases (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      UNIQUE(canvas_id, user_id)
    )
  `);

  await createTable(`
    CREATE TABLE IF NOT EXISTS canvas_conflicts (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL,
      conflict_type TEXT NOT NULL,
      field_keys TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      resolved ${boolType} DEFAULT ${defaultBoolFalse},
      detected_at ${timestampType} NOT NULL,
      FOREIGN KEY (canvas_id) REFERENCES canvases (id)
    )
  `);

  await createTable(`
    CREATE TABLE IF NOT EXISTS canvas_learnings (
      id TEXT PRIMARY KEY,
      pattern_type TEXT NOT NULL,
      field_key TEXT,
      pattern_data TEXT NOT NULL,
      frequency INTEGER DEFAULT 1,
      last_seen ${timestampType} NOT NULL,
      created_at ${timestampType} NOT NULL
    )
  `);

  await createTable(`
    CREATE TABLE IF NOT EXISTS refinement_history (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL,
      field_key TEXT NOT NULL,
      field_label TEXT NOT NULL,
      before_value TEXT NOT NULL,
      after_value TEXT NOT NULL,
      instruction TEXT NOT NULL,
      industry TEXT,
      created_at ${timestampType} NOT NULL,
      FOREIGN KEY (canvas_id) REFERENCES canvases (id) ON DELETE CASCADE
    )
  `);

  // Create indexes
  await createIndexIfNotExists(database, "idx_canvases_status", "canvases", "status");
  await createIndexIfNotExists(database, "idx_canvases_updated", "canvases", "updated_at");
  await createIndexIfNotExists(database, "idx_messages_canvas", "chat_messages", "canvas_id");
  await createIndexIfNotExists(database, "idx_files_canvas", "uploaded_files", "canvas_id");
  await createIndexIfNotExists(database, "idx_documents_uploaded", "company_documents", "uploaded_at");
  await createIndexIfNotExists(database, "idx_versions_canvas", "canvas_versions", "canvas_id");
  await createIndexIfNotExists(database, "idx_comments_canvas", "canvas_comments", "canvas_id");
  await createIndexIfNotExists(database, "idx_comments_field", "canvas_comments", "field_key");
  await createIndexIfNotExists(database, "idx_comments_parent", "canvas_comments", "parent_id");
  await createIndexIfNotExists(database, "idx_users_email", "users", "email");
  await createIndexIfNotExists(database, "idx_users_team", "users", "team_id");
  await createIndexIfNotExists(database, "idx_permissions_canvas", "canvas_permissions", "canvas_id");
  await createIndexIfNotExists(database, "idx_permissions_user", "canvas_permissions", "user_id");
  await createIndexIfNotExists(database, "idx_conflicts_canvas", "canvas_conflicts", "canvas_id");
  await createIndexIfNotExists(database, "idx_learnings_pattern", "canvas_learnings", "pattern_type");
  await createIndexIfNotExists(database, "idx_refinement_canvas", "refinement_history", "canvas_id");
  await createIndexIfNotExists(database, "idx_refinement_field", "refinement_history", "field_key");
  await createIndexIfNotExists(database, "idx_refinement_created", "refinement_history", "created_at");

  // Create default admin user if no users exist
  try {
    const userCount = await database.queryOne("SELECT COUNT(*) as count FROM users");
    const countValue = (userCount as { count?: number | string } | undefined)?.count ?? 0;
    const count = typeof countValue === "number" ? countValue : Number(countValue) || 0;

    if (count === 0) {
      const defaultEmail = process.env.DEFAULT_ADMIN_EMAIL || "admin@example.com";
      const defaultPassword =
        process.env.DEFAULT_ADMIN_PASSWORD ||
        crypto.randomBytes(12).toString("base64url");
      const passwordHash = bcrypt.hashSync(defaultPassword, 10);
      const id = nanoid();
      const now = new Date().toISOString();

      await database.execute(
        `INSERT INTO users (id, email, name, password_hash, role, team_id, must_change_password, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, defaultEmail, "Admin User", passwordHash, "admin", null, true, now, now]
      );

      console.log("✅ Default admin user created:", defaultEmail);
      if (process.env.DEFAULT_ADMIN_PASSWORD) {
        console.log("⚠️  SECURITY WARNING: Default admin password was loaded from DEFAULT_ADMIN_PASSWORD. Rotate it immediately after first login.");
      } else {
        console.log(
          "⚠️  SECURITY WARNING: A one-time admin password was generated. Please log in and rotate it immediately."
        );
        console.log(`🔑 Temporary password: ${defaultPassword}`);
      }
    }
  } catch (error) {
    console.error("Failed to create default admin user:", error);
  }
}

/**
 * Helper to create index if it doesn't exist
 */
async function createIndexIfNotExists(
  database: DatabaseClient,
  indexName: string,
  tableName: string,
  columnName: string
): Promise<void> {
  try {
    await database.execute(
      `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName}(${columnName})`
    );
  } catch (error) {
    // Index might already exist in PostgreSQL
    console.log(`Index ${indexName} might already exist`);
  }
}

/**
 * Runs database migrations
 * Called automatically on first database connection
 */
async function runMigrations(database: DatabaseClient): Promise<void> {
  const isPostgres = database instanceof PostgresClient;

  // Create migrations table if it doesn't exist
  await database.execute(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  // Get already applied migrations
  const appliedMigrations = await database.query(
    'SELECT name FROM migrations'
  ) as Array<{ name: string }>;
  const appliedSet = new Set(appliedMigrations.map(m => m.name));

  // Define migrations inline (easier than reading files at runtime)
  const migrations = [
    {
      name: '001_add_canvas_fields.sql',
      sql: isPostgres
        ? `
          DO $$
          BEGIN
              IF NOT EXISTS (
                  SELECT 1
                  FROM information_schema.columns
                  WHERE table_name = 'company_settings'
                  AND column_name = 'canvas_fields'
              ) THEN
                  ALTER TABLE company_settings ADD COLUMN canvas_fields TEXT;
              END IF;
          END $$;
        `
        : `ALTER TABLE company_settings ADD COLUMN canvas_fields TEXT`
    },
    {
      name: '002_add_pgvector_for_rag.sql',
      sql: isPostgres
        ? `
          -- Enable pgvector extension (PostgreSQL only)
          -- This will be skipped gracefully if pgvector is not available
          DO $$
          BEGIN
            CREATE EXTENSION IF NOT EXISTS vector;
          EXCEPTION
            WHEN undefined_file THEN
              RAISE NOTICE 'pgvector extension not available - RAG features will be disabled';
            WHEN OTHERS THEN
              RAISE NOTICE 'Could not create pgvector extension: %', SQLERRM;
          END
          $$;

          -- Create document_chunks table for RAG
          -- Only create if pgvector extension is available
          DO $$
          BEGIN
            IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
              CREATE TABLE IF NOT EXISTS document_chunks (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                canvas_id TEXT,
                chunk_index INTEGER NOT NULL,
                content TEXT NOT NULL,
                embedding vector(1536),
                token_count INTEGER NOT NULL,
                metadata JSONB,
                created_at TIMESTAMP DEFAULT NOW(),
                FOREIGN KEY (canvas_id) REFERENCES canvases(id) ON DELETE CASCADE
              );

              -- Create index for vector similarity search (cosine distance)
              CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
              ON document_chunks USING ivfflat (embedding vector_cosine_ops)
              WITH (lists = 100);

              -- Create index for document lookup
              CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id
              ON document_chunks(document_id);

              -- Create index for canvas-specific chunks
              CREATE INDEX IF NOT EXISTS idx_document_chunks_canvas_id
              ON document_chunks(canvas_id);

              RAISE NOTICE 'pgvector RAG tables created successfully';
            ELSE
              RAISE NOTICE 'pgvector extension not found - skipping RAG table creation';
            END IF;
          END
          $$;
        `
        : '' // SQLite: Skip pgvector migration (not supported)
    },
    {
      name: '003_add_document_ids_to_canvases.sql',
      sql: isPostgres
        ? `
          -- Add document_ids column to canvases table for tracking uploaded documents
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'canvases'
              AND column_name = 'document_ids'
            ) THEN
              ALTER TABLE canvases ADD COLUMN document_ids TEXT;
            END IF;
          END $$;
        `
        : `
          -- SQLite: Add document_ids column if it doesn't exist
          -- SQLite doesn't have IF NOT EXISTS for columns, so we ignore errors
          ALTER TABLE canvases ADD COLUMN document_ids TEXT;
        `
    },
    {
      name: '004_add_field_key_to_document_chunks.sql',
      sql: isPostgres
        ? `
          -- Add field_key column to document_chunks for field-specific RAG
          DO $$
          BEGIN
            -- Only run if document_chunks table exists (pgvector enabled)
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_chunks') THEN
              IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'document_chunks'
                AND column_name = 'field_key'
              ) THEN
                ALTER TABLE document_chunks ADD COLUMN field_key TEXT;

                -- Create index for field-specific chunk lookup
                CREATE INDEX IF NOT EXISTS idx_document_chunks_field_key
                ON document_chunks(field_key);

                RAISE NOTICE 'Added field_key column to document_chunks for field-specific RAG';
              END IF;
            END IF;
          END $$;
        `
        : '' // SQLite: Skip (no RAG support)
    }
    ,
    {
      name: '005_add_roles_and_field_availability.sql',
      sql: isPostgres
        ? `
          DO $$
          BEGIN
              IF NOT EXISTS (
                  SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'company_settings'
                  AND column_name = 'role_definitions'
              ) THEN
                  ALTER TABLE company_settings ADD COLUMN role_definitions TEXT;
              END IF;

              IF NOT EXISTS (
                  SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'company_settings'
                  AND column_name = 'field_availability'
              ) THEN
                  ALTER TABLE company_settings ADD COLUMN field_availability TEXT;
              END IF;
          END $$;
        `
        : `
          -- SQLite: add JSON columns for roles and field availability (ignore if they already exist)
          ALTER TABLE company_settings ADD COLUMN role_definitions TEXT;
          ALTER TABLE company_settings ADD COLUMN field_availability TEXT;
        `
    }
  ];

  // Run pending migrations
  for (const migration of migrations) {
    if (appliedSet.has(migration.name)) {
      continue; // Already applied
    }

    try {
      await database.execute(migration.sql);

      // Record migration as applied
      const now = new Date().toISOString();
      await database.execute(
        'INSERT INTO migrations (id, name, applied_at) VALUES ($1, $2, $3)',
        [migration.name, migration.name, now]
      );

      console.log(`[MIGRATION] ✓ Applied ${migration.name}`);
    } catch (error: unknown) {
      const err = error as { message?: string };
      // For SQLite, ignore "duplicate column" errors
      if (!isPostgres && err.message?.includes('duplicate column')) {
        console.log(`[MIGRATION] ⊙ ${migration.name} (column already exists)`);
        // Still record it as applied
        const now = new Date().toISOString();
        await database.execute(
          'INSERT INTO migrations (id, name, applied_at) VALUES ($1, $2, $3)',
          [migration.name, migration.name, now]
        );
      } else {
        console.error(`[MIGRATION] ✗ Failed to apply ${migration.name}:`, error);
        throw error;
      }
    }
  }
}

/**
 * Closes the database connection
 */
export function closeDatabase(): void {
  if (dbClient) {
    dbClient.close();
    dbClient = null;
  }
}
