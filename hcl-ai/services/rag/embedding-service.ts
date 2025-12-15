import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { getDatabase } from "../database/client";
import type { DocumentChunk } from "./document-processor";

/**
 * Embedded chunk with vector
 */
export interface EmbeddedChunk extends DocumentChunk {
  embedding: number[];
}

/**
 * RAG query result
 */
export interface RAGResult {
  chunks: Array<{
    content: string;
    similarity: number;
    metadata: Record<string, unknown>;
  }>;
  totalChunks: number;
}

/**
 * Generate embedding for a single text using Vercel AI SDK
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const { embedding } = await embed({
      model: openai.embedding("text-embedding-3-small"),
      value: text,
    });

    return embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error(
      `Failed to generate embedding: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Generate embeddings for multiple chunks using Vercel AI SDK
 */
export async function generateEmbeddings(
  chunks: DocumentChunk[]
): Promise<EmbeddedChunk[]> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    console.log(`🔮 Generating embeddings for ${chunks.length} chunks...`);

    // Extract text from chunks
    const texts = chunks.map((chunk) => chunk.content);

    // Generate embeddings in batch
    const { embeddings } = await embedMany({
      model: openai.embedding("text-embedding-3-small"),
      values: texts,
    });

    // Combine chunks with embeddings
    const embeddedChunks: EmbeddedChunk[] = chunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index],
    }));

    console.log(`✅ Generated ${embeddedChunks.length} embeddings`);
    return embeddedChunks;
  } catch (error) {
    console.error("Error generating embeddings:", error);
    throw new Error(
      `Failed to generate embeddings: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Store embedded chunks in PostgreSQL with pgvector
 */
export async function storeEmbeddedChunks(
  embeddedChunks: EmbeddedChunk[]
): Promise<void> {
  const db = await getDatabase();
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.log("⚠️  RAG: Skipping chunk storage (SQLite mode - pgvector not supported)");
    return;
  }

  try {
    console.log(`💾 Storing ${embeddedChunks.length} chunks in database...`);

    for (const chunk of embeddedChunks) {
      await db.execute(
        `INSERT INTO document_chunks (id, document_id, canvas_id, field_key, chunk_index, content, embedding, token_count, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (id) DO UPDATE SET
           content = EXCLUDED.content,
           embedding = EXCLUDED.embedding,
           token_count = EXCLUDED.token_count,
           metadata = EXCLUDED.metadata,
           field_key = EXCLUDED.field_key`,
        [
          chunk.id,
          chunk.documentId,
          chunk.canvasId,
          chunk.fieldKey || null,
          chunk.chunkIndex,
          chunk.content,
          `[${chunk.embedding.join(',')}]`, // pgvector vector format
          chunk.tokenCount,
          JSON.stringify(chunk.metadata),
        ]
      );
    }

    console.log(`✅ Stored ${embeddedChunks.length} chunks successfully`);
  } catch (error) {
    console.error("Error storing embedded chunks:", error);
    throw new Error(
      `Failed to store chunks: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Query similar chunks using vector similarity search
 * Returns top-k most similar chunks to the query
 */
export async function querySimilarChunks(
  query: string,
  options: {
    canvasId?: string | null;
    documentIds?: string[];
    fieldKey?: string | null;
    limit?: number;
    similarityThreshold?: number;
    chunksPerDocument?: number;
  } = {}
): Promise<RAGResult> {
  const db = await getDatabase();
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.log("⚠️  RAG: Skipping similarity search (SQLite mode - pgvector not supported)");
    return { chunks: [], totalChunks: 0 };
  }

  const limit = options.limit || 5;
  const similarityThreshold = options.similarityThreshold || 0.7;
  const chunksPerDocument = options.chunksPerDocument;

  try {
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);

    // Build SQL query with optional canvas filter
    let sql = `
      SELECT
        content,
        1 - (embedding <=> $1::vector) as similarity,
        metadata,
        document_id,
        chunk_index
      FROM document_chunks
      WHERE 1=1
    `;

    // Pass embedding as JSON string (pgvector will parse it)
    const params: unknown[] = [`[${queryEmbedding.join(',')}]`];

    // Filter by field key if specified (for field-specific documents)
    if (options.fieldKey) {
      sql += ` AND (field_key = $${params.length + 1} OR field_key IS NULL)`;
      params.push(options.fieldKey);
    }

    // Filter by document IDs if specified (for canvas-specific documents)
    // ALSO include global documents (canvas_id IS NULL) to provide company context
    if (options.documentIds && options.documentIds.length > 0) {
      const placeholders = options.documentIds.map((_, i) => `$${params.length + 1 + i}`).join(', ');
      sql += ` AND (document_id IN (${placeholders}) OR canvas_id IS NULL)`;
      params.push(...options.documentIds);
    }
    // Otherwise, filter by canvas if specified (or include global docs if canvasId is null)
    else if (options.canvasId !== undefined) {
      sql += ` AND (canvas_id = $${params.length + 1} OR canvas_id IS NULL)`;
      params.push(options.canvasId);
    }

    sql += `
      ORDER BY embedding <=> $1::vector
      LIMIT $${params.length + 1}
    `;
    params.push(limit);

    const results = (await db.query(sql, params)) as Array<{
      content: string;
      similarity: number;
      metadata: Record<string, unknown> | string;
      document_id: string;
      chunk_index: number;
    }>;

    // Filter by similarity threshold and parse metadata if needed
    let chunks = results
      .filter((r) => r.similarity >= similarityThreshold)
      .map((r) => ({
        content: r.content,
        similarity: r.similarity,
        metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
      }));

    // If chunksPerDocument is specified, ensure diversity across documents
    if (chunksPerDocument && chunks.length > 0) {
      const chunksByDoc = new Map<string, typeof chunks>();

      for (const chunk of chunks) {
        const filename = (chunk.metadata.filename as string) || 'unknown';
        if (!chunksByDoc.has(filename)) {
          chunksByDoc.set(filename, []);
        }
        const docChunks = chunksByDoc.get(filename)!;
        if (docChunks.length < chunksPerDocument) {
          docChunks.push(chunk);
        }
      }

      // Flatten back to array, maintaining similarity order within each doc
      chunks = Array.from(chunksByDoc.values()).flat();
      console.log(`🔍 Found ${chunks.length} chunks from ${chunksByDoc.size} document(s) (max ${chunksPerDocument} per doc)`);
    } else {
      console.log(`🔍 Found ${chunks.length} relevant chunks (similarity >= ${similarityThreshold})`);
    }

    return {
      chunks,
      totalChunks: results.length,
    };
  } catch (error) {
    console.error("Error querying similar chunks:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw new Error(
      `Failed to query chunks: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Delete all chunks for a document
 */
export async function deleteDocumentChunks(documentId: string): Promise<void> {
  const db = await getDatabase();
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.log("⚠️  RAG: Skipping chunk deletion (SQLite mode)");
    return;
  }

  try {
    await db.execute("DELETE FROM document_chunks WHERE document_id = $1", [
      documentId,
    ]);
    console.log(`🗑️  Deleted chunks for document: ${documentId}`);
  } catch (error) {
    console.error("Error deleting document chunks:", error);
    throw new Error(
      `Failed to delete chunks: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Delete all chunks for a canvas
 */
export async function deleteCanvasChunks(canvasId: string): Promise<void> {
  const db = await getDatabase();
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.log("⚠️  RAG: Skipping chunk deletion (SQLite mode)");
    return;
  }

  try {
    await db.execute("DELETE FROM document_chunks WHERE canvas_id = $1", [
      canvasId,
    ]);
    console.log(`🗑️  Deleted chunks for canvas: ${canvasId}`);
  } catch (error) {
    console.error("Error deleting canvas chunks:", error);
    throw new Error(
      `Failed to delete chunks: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Get chunk statistics
 */
export async function getChunkStats(
  canvasId?: string
): Promise<{ totalChunks: number; totalDocuments: number }> {
  const db = await getDatabase();
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return { totalChunks: 0, totalDocuments: 0 };
  }

  try {
    let sql = "SELECT COUNT(*) as total_chunks, COUNT(DISTINCT document_id) as total_documents FROM document_chunks";
    const params: unknown[] = [];

    if (canvasId) {
      sql += " WHERE canvas_id = $1";
      params.push(canvasId);
    }

    const result = (await db.queryOne(sql, params)) as
      | { total_chunks: number; total_documents: number }
      | undefined;

    return {
      totalChunks: result?.total_chunks || 0,
      totalDocuments: result?.total_documents || 0,
    };
  } catch (error) {
    console.error("Error getting chunk stats:", error);
    return { totalChunks: 0, totalDocuments: 0 };
  }
}
