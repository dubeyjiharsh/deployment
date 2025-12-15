import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { nanoid } from "nanoid";
import {
  extractTextFromFile,
  chunkDocument,
  validateFile,
} from "@/services/rag/document-processor";
import {
  generateEmbeddings,
  storeEmbeddedChunks,
} from "@/services/rag/embedding-service";
import { canUserAccessCanvas } from "@/services/database/canvas-repository";
import { userRepository } from "@/services/database/user-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/canvas/documents/upload
 * Upload and process documents for RAG
 *
 * Request body: multipart/form-data
 * - file: File (PDF, DOCX, DOC, TXT, MD)
 * - canvasId: string (optional - null for global company docs)
 *
 * Response:
 * - documentId: string
 * - filename: string
 * - chunksCreated: number
 * - tokensProcessed: number
 */
export async function POST(req: NextRequest) {
  try {
    // Authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const canvasId = (formData.get("canvasId") as string) || null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file
    const validation = validateFile(file.name, file.type, file.size);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // SECURITY: Verify user has access to the canvas before allowing document upload
    if (canvasId) {
      const user = await userRepository.getUserById(session.user.id);
      const isAdmin = user?.role === "admin";
      const hasAccess = isAdmin || await canUserAccessCanvas(canvasId, session.user.id);
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    console.log(`📄 Processing upload (${file.size} bytes)`);

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from file
    const extracted = await extractTextFromFile(
      buffer,
      file.name,
      file.type
    );

    console.log(`📝 Extracted ${extracted.text.length} characters from uploaded file`);

    // Generate unique document ID
    const documentId = nanoid();

    // Chunk the document
    const chunks = chunkDocument(extracted.text, documentId, canvasId, {
      filename: file.name,
      maxTokens: 800,
      overlapTokens: 100,
    });

    console.log(`✂️  Created ${chunks.length} chunks`);

    // Check if we're in PostgreSQL mode (RAG only works with Postgres)
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.log("⚠️  RAG: SQLite mode detected - skipping embedding generation");
      return NextResponse.json({
        documentId,
        filename: file.name,
        chunksCreated: 0,
        tokensProcessed: 0,
        mode: "sqlite",
        message: "Document uploaded but RAG is only available with PostgreSQL",
      });
    }

    // Generate embeddings for chunks
    const embeddedChunks = await generateEmbeddings(chunks);

    // Store chunks with embeddings in database
    await storeEmbeddedChunks(embeddedChunks);

    // Calculate total tokens processed
    const tokensProcessed = chunks.reduce(
      (sum, chunk) => sum + chunk.tokenCount,
      0
    );

    console.log(`✅ Document processed: ${documentId}`);

    return NextResponse.json({
      documentId,
      filename: file.name,
      chunksCreated: chunks.length,
      tokensProcessed,
      mode: "postgres",
    });
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to upload document",
      },
      { status: 500 }
    );
  }
}
