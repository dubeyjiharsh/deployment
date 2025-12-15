import { NextRequest, NextResponse } from "next/server";
import { settingsRepository } from "@/services/database/settings-repository";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";

/**
 * GET /api/settings/documents/[id]
 * Retrieves a specific document by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;
    const document = await settingsRepository.getDocumentById(id);

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      document,
    });
  } catch (error) {
    console.error("Error fetching document:", error);

    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/documents/[id]
 * Deletes a document by ID
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;

    // Delete RAG chunks if PostgreSQL is available
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
      try {
        const { deleteDocumentChunks } = await import("@/services/rag/embedding-service");
        await deleteDocumentChunks(id);
        console.log(`🗑️  [GLOBAL DOC] Deleted RAG chunks for document: ${id}`);
      } catch (error) {
        console.error("❌ [GLOBAL DOC] Failed to delete chunks:", error);
        // Continue with document deletion even if chunk deletion fails
      }
    }

    const deleted = await settingsRepository.deleteDocument(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting document:", error);

    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
