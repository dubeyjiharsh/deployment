import { NextRequest, NextResponse } from "next/server";
import { settingsRepository } from "@/services/database/settings-repository";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import {
  parseDocument,
  validateFileSize,
  isSupportedMimeType,
  isSupportedFileExtension,
} from "@/lib/utils/document-parser";

/**
 * POST /api/settings/documents
 * Uploads and parses a company document
 */
export async function POST(req: NextRequest) {
  // Apply authentication and rate limiting
  const { response } = await applyApiMiddleware(
    req,
    {
      ...MIDDLEWARE_PRESETS.AUTH,
      requireAdmin: true,
    }
  );
  if (response) return response;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!validateFileSize(file.size)) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Validate file type using both MIME type and file extension
    // This handles browser inconsistencies in MIME type reporting
    if (!isSupportedMimeType(file.type) || !isSupportedFileExtension(file.name)) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload TXT or MD files." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const content = await parseDocument(buffer, file.type);

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Document appears to be empty or could not be parsed" },
        { status: 400 }
      );
    }

    const document = await settingsRepository.addDocument({
      filename: file.name,
      content,
      mimeType: file.type,
    });

    // Process document with RAG (chunk and embed) if PostgreSQL is available
    const databaseUrl = process.env.DATABASE_URL;
    let chunksCreated = 0;

    if (databaseUrl) {
      try {
        const { chunkDocument } = await import("@/services/rag/document-processor");
        const { generateEmbeddings, storeEmbeddedChunks } = await import("@/services/rag/embedding-service");

        // Chunk the document (canvas_id is null for global documents)
        const chunks = chunkDocument(content, document.id, null, {
          filename: file.name,
          maxTokens: 800,
          overlapTokens: 100,
        });

        console.log(`📄 [GLOBAL DOC] Chunking "${file.name}": ${chunks.length} chunks created`);

        // Generate embeddings
        const embeddedChunks = await generateEmbeddings(chunks);

        // Store in database
        await storeEmbeddedChunks(embeddedChunks);

        chunksCreated = chunks.length;
        console.log(`✅ [GLOBAL DOC] RAG processing complete: ${chunksCreated} chunks embedded`);
      } catch (error) {
        console.error("❌ [GLOBAL DOC] RAG processing failed:", error);
        // Don't fail the upload if RAG processing fails
      }
    } else {
      console.log("⚠️  [GLOBAL DOC] SQLite mode: RAG not available for global documents");
    }

    return NextResponse.json({
      document,
      chunksCreated,
      message: "Document uploaded successfully",
    });
  } catch (error) {
    console.error("Error uploading document:", error);

    return NextResponse.json(
      {
        error: "Failed to upload document",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/settings/documents
 * Retrieves all company documents
 */
export async function GET(req: NextRequest) {
  // Apply authentication and rate limiting
  const { response } = await applyApiMiddleware(
    req,
    {
      ...MIDDLEWARE_PRESETS.AUTH,
      requireAdmin: true,
    }
  );
  if (response) return response;

  try {
    const documents = await settingsRepository.getDocuments();

    return NextResponse.json({
      documents,
    });
  } catch (error) {
    console.error("Error fetching documents:", error);

    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
