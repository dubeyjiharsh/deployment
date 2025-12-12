import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDatabase } from "@/services/database/client";
import { settingsRepository } from "@/services/database/settings-repository";
import { auth } from "@/lib/auth";
import type { FieldConfiguration } from "@/lib/validators/settings-schema";
import type { DocumentChunk } from "@/services/rag/document-processor";
import type { EmbeddedChunk } from "@/services/rag/embedding-service";

// Required for file uploads to work properly
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Import RAG services (conditionally available based on pgvector)
const isPgVectorAvailable = !!process.env.DATABASE_URL;

/**
 * POST /api/settings/field-documents
 * Upload and process a document for a specific field
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can manage field documents
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const fieldKey = formData.get("fieldKey") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!fieldKey) {
      return NextResponse.json({ error: "Field key is required" }, { status: 400 });
    }

    // Verify the field exists in settings
    // Note: We skip this validation because the field might be in the process of being created
    // The field configuration will be updated after upload anyway
    // If the field doesn't exist, the document will be uploaded but not linked (logged as warning)

    // Validate file type
    const allowedTypes = [
      "text/plain",
      "text/markdown",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload TXT, MD, PDF, or DOCX files." },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Extract text content based on file type
    let textContent = "";

    if (file.type === "text/plain" || file.type === "text/markdown") {
      textContent = await file.text();
    } else if (file.type === "application/pdf") {
      // Use pdf-parse for PDF extraction
      const pdfParse = (await import("pdf-parse")).default;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const pdfData = await pdfParse(buffer);
      textContent = pdfData.text;
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.type === "application/msword"
    ) {
      // Use mammoth for DOCX extraction
      const mammoth = await import("mammoth");
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const result = await mammoth.extractRawText({ buffer });
      textContent = result.value;
    }

    if (!textContent || textContent.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from document" },
        { status: 400 }
      );
    }

    // Store document metadata
    const documentId = nanoid();
    const db = await getDatabase();

    try {
      await db.execute(
        `INSERT INTO company_documents (id, filename, content, mime_type, uploaded_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [documentId, file.name, textContent, file.type, new Date().toISOString()]
      );
      console.log(`✅ Stored document metadata: ${documentId}`);
    } catch (error) {
      console.error("Error storing document metadata:", error);
      return NextResponse.json(
        { error: "Failed to store document metadata" },
        { status: 500 }
      );
    }

    // Process with RAG if available
    let chunkCount = 0;

    if (isPgVectorAvailable) {
      try {
        const { chunkDocument } = await import("@/services/rag/document-processor");
        const { generateEmbeddings, storeEmbeddedChunks } = await import("@/services/rag/embedding-service");

        // Chunk the document with field key
        const chunks: DocumentChunk[] = chunkDocument(textContent, documentId, null, {
          maxTokens: 800,
          overlapTokens: 100,
          filename: file.name,
          fieldKey: fieldKey,
        });

        console.log(`📦 Created ${chunks.length} chunks for document`);

        if (chunks && chunks.length > 0) {
          // Generate embeddings
          const embeddedChunks: EmbeddedChunk[] = await generateEmbeddings(chunks);

          // Store in database
          await storeEmbeddedChunks(embeddedChunks);

          chunkCount = chunks.length;
          console.log(`✅ Successfully processed ${chunkCount} chunks with embeddings`);
        }
      } catch (error) {
        console.error("❌ Error processing document for RAG:", error);

        // Rollback: Delete the document metadata since RAG failed
        try {
          await db.execute(`DELETE FROM company_documents WHERE id = $1`, [documentId]);
          console.log(`🔄 Rolled back document metadata due to RAG failure`);
        } catch (rollbackError) {
          console.error("Error during rollback:", rollbackError);
        }

        return NextResponse.json(
          { error: "Failed to process document for RAG. Please try again." },
          { status: 500 }
        );
      }
    }

    // Update field configuration to include this document
    const settings = await settingsRepository.getSettings();
    if (settings?.canvasFields) {
      let fieldFound = false;
      const updatedFields = settings.canvasFields.map((field: FieldConfiguration) => {
        if (field.fieldKey === fieldKey) {
          fieldFound = true;
          const documents = field.documents || [];

          // Check for duplicate filename (optional: could allow duplicates with different IDs)
          const existingDoc = documents.find(d => d.filename === file.name);
          if (existingDoc) {
            console.warn(`⚠️ Document with filename "${file.name}" already exists for field "${field.name}". Adding anyway with new ID.`);
          }

          console.log(`✅ Linking document ${documentId} to field "${field.name}" (${fieldKey})`);

          return {
            ...field,
            documents: [
              ...documents,
              {
                id: documentId,
                filename: file.name,
                uploadedAt: new Date().toISOString(),
              },
            ],
          };
        }
        return field;
      });

      if (!fieldFound) {
        console.error(`❌ Field with key "${fieldKey}" not found in canvasFields. Available fields:`,
          settings.canvasFields.map(f => ({ name: f.name, key: f.fieldKey })));

        // Clean up the uploaded document since we can't link it
        await db.execute(`DELETE FROM company_documents WHERE id = $1`, [documentId]);
        if (isPgVectorAvailable) {
          await db.execute(`DELETE FROM document_chunks WHERE document_id = $1`, [documentId]);
        }

        return NextResponse.json(
          { error: `Field with key "${fieldKey}" not found. Please save the field first before uploading documents.` },
          { status: 404 }
        );
      }

      await settingsRepository.upsertSettings({
        canvasFields: updatedFields,
      });
    } else {
      // Edge case: settings or canvasFields don't exist
      console.warn("⚠️ No canvas fields found in settings. Document uploaded but not linked to field.");
      try {
        await db.execute(`DELETE FROM company_documents WHERE id = $1`, [documentId]);
        if (isPgVectorAvailable) {
          await db.execute(`DELETE FROM document_chunks WHERE document_id = $1`, [documentId]);
        }
      } catch (cleanupError) {
        console.error("Error cleaning up unlinked document:", cleanupError);
      }
      return NextResponse.json(
        { error: "Canvas fields not initialized. Please refresh and try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      documentId,
      filename: file.name,
      chunkCount,
      ragEnabled: isPgVectorAvailable,
    });
  } catch (error) {
    console.error("Error uploading field document:", error);
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/field-documents
 * Delete a field-specific document
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can manage field documents
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId");
    const fieldKey = searchParams.get("fieldKey");

    if (!documentId || !fieldKey) {
      return NextResponse.json(
        { error: "Document ID and field key are required" },
        { status: 400 }
      );
    }

    const db = await getDatabase();

    // Delete document chunks if RAG is enabled
    // Delete ALL chunks for this document ID (not just field-specific ones)
    // This ensures complete cleanup even if field_key is null or mismatched
    if (isPgVectorAvailable) {
      try {
        await db.execute(
          `DELETE FROM document_chunks WHERE document_id = $1`,
          [documentId]
        );
        console.log(`🗑️ Deleted all chunks for document: ${documentId}`);
      } catch (error) {
        console.error("Error deleting document chunks:", error);
        // Don't throw - continue with document deletion
      }
    }

    // Delete document metadata
    await db.execute(`DELETE FROM company_documents WHERE id = $1`, [documentId]);
    console.log(`🗑️ Deleted document metadata: ${documentId}`);

    // Update field configuration to remove this document
    const settings = await settingsRepository.getSettings();
    if (settings?.canvasFields) {
      const updatedFields = settings.canvasFields.map((field: FieldConfiguration) => {
        if (field.fieldKey === fieldKey && field.documents) {
          return {
            ...field,
            documents: field.documents.filter((doc) => doc.id !== documentId),
          };
        }
        return field;
      });

      await settingsRepository.upsertSettings({
        canvasFields: updatedFields,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting field document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
