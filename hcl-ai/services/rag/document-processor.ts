import mammoth from "mammoth";
import { encoding_for_model } from "tiktoken";
import { nanoid } from "nanoid";

/**
 * Extracted document with metadata
 */
export interface ExtractedDocument {
  text: string;
  metadata: {
    filename: string;
    mimeType: string;
    pageCount?: number;
    extractedAt: string;
  };
}

/**
 * Document chunk for RAG
 */
export interface DocumentChunk {
  id: string;
  documentId: string;
  canvasId: string | null;
  fieldKey?: string | null; // Field-specific association
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: Record<string, unknown>;
}

/**
 * Extract text from uploaded file based on MIME type
 */
export async function extractTextFromFile(
  file: Buffer,
  filename: string,
  mimeType: string
): Promise<ExtractedDocument> {
  const extractedAt = new Date().toISOString();

  try {
    // PDF files
    if (mimeType === "application/pdf" || filename.endsWith(".pdf")) {
      // Use pdf-parse for PDF extraction
      const pdfParse = (await import("pdf-parse")).default;
      const pdfData = await pdfParse(file);
      return {
        text: pdfData.text,
        metadata: {
          filename,
          mimeType: "application/pdf",
          pageCount: pdfData.numpages,
          extractedAt,
        },
      };
    }

    // DOCX files
    if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      filename.endsWith(".docx")
    ) {
      const result = await mammoth.extractRawText({ buffer: file });
      return {
        text: result.value,
        metadata: {
          filename,
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          extractedAt,
        },
      };
    }

    // DOC files (older Word format)
    if (
      mimeType === "application/msword" ||
      filename.endsWith(".doc")
    ) {
      // Mammoth supports .doc files too
      const result = await mammoth.extractRawText({ buffer: file });
      return {
        text: result.value,
        metadata: {
          filename,
          mimeType: "application/msword",
          extractedAt,
        },
      };
    }

    // Plain text files
    if (
      mimeType === "text/plain" ||
      mimeType === "text/markdown" ||
      filename.endsWith(".txt") ||
      filename.endsWith(".md")
    ) {
      return {
        text: file.toString("utf-8"),
        metadata: {
          filename,
          mimeType: mimeType || "text/plain",
          extractedAt,
        },
      };
    }

    throw new Error(`Unsupported file type: ${mimeType || "unknown"}`);
  } catch (error) {
    console.error("Error extracting text from file:", error);
    throw new Error(
      `Failed to extract text from ${filename}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Chunk text into smaller pieces for embedding
 * Uses a sliding window approach with overlap to maintain context
 */
export function chunkDocument(
  text: string,
  documentId: string,
  canvasId: string | null,
  options: {
    maxTokens?: number;
    overlapTokens?: number;
    filename?: string;
    fieldKey?: string | null;
  } = {}
): DocumentChunk[] {
  const maxTokens = options.maxTokens || 800; // ~800 tokens per chunk
  const overlapTokens = options.overlapTokens || 100; // ~100 tokens overlap
  const filename = options.filename || "unknown";
  const fieldKey = options.fieldKey || null;

  // Initialize tokenizer (GPT-4/3.5 compatible)
  const encoder = encoding_for_model("gpt-4");

  // Split by paragraphs first (better semantic boundaries)
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: DocumentChunk[] = [];
  let currentChunk = "";
  let currentTokens = 0;
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokens = encoder.encode(paragraph);
    const paragraphTokenCount = paragraphTokens.length;

    // If adding this paragraph would exceed max tokens, save current chunk
    if (currentTokens + paragraphTokenCount > maxTokens && currentChunk.length > 0) {
      chunks.push({
        id: nanoid(),
        documentId,
        canvasId,
        fieldKey,
        chunkIndex,
        content: currentChunk.trim(),
        tokenCount: currentTokens,
        metadata: {
          filename,
          chunkIndex,
          totalChunks: 0, // Will be updated later
        },
      });

      chunkIndex++;

      // Create overlap: take last N tokens from current chunk
      const overlapText = getLastNTokens(currentChunk, overlapTokens, encoder);
      currentChunk = overlapText + "\n\n" + paragraph;
      currentTokens = encoder.encode(currentChunk).length;
    } else {
      // Add paragraph to current chunk
      currentChunk += (currentChunk.length > 0 ? "\n\n" : "") + paragraph;
      currentTokens += paragraphTokenCount;
    }
  }

  // Add final chunk if any content remains
  if (currentChunk.trim().length > 0) {
    chunks.push({
      id: nanoid(),
      documentId,
      canvasId,
      fieldKey,
      chunkIndex,
      content: currentChunk.trim(),
      tokenCount: currentTokens,
      metadata: {
        filename,
        chunkIndex,
        totalChunks: 0,
      },
    });
  }

  // Update totalChunks in metadata
  const totalChunks = chunks.length;
  chunks.forEach((chunk) => {
    chunk.metadata.totalChunks = totalChunks;
  });

  encoder.free(); // Free memory

  return chunks;
}

/**
 * Get last N tokens from text (for overlap)
 */
function getLastNTokens(
  text: string,
  n: number,
  encoder: ReturnType<typeof encoding_for_model>
): string {
  const tokens = encoder.encode(text);

  if (tokens.length <= n) {
    return text;
  }

  const lastNTokens = tokens.slice(-n);
  return new TextDecoder().decode(encoder.decode(lastNTokens));
}

/**
 * Count tokens in text
 */
export function countTokens(text: string): number {
  const encoder = encoding_for_model("gpt-4");
  const tokens = encoder.encode(text);
  const count = tokens.length;
  encoder.free();
  return count;
}

/**
 * Validate file type and size
 */
export function validateFile(
  filename: string,
  mimeType: string | null,
  size: number
): { valid: boolean; error?: string } {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "text/markdown",
  ];

  const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc", ".txt", ".md"];

  // Check file size
  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  // Check file type
  const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) =>
    filename.toLowerCase().endsWith(ext)
  );
  const hasValidMimeType = mimeType && ALLOWED_TYPES.includes(mimeType);

  if (!hasValidExtension && !hasValidMimeType) {
    return {
      valid: false,
      error: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
    };
  }

  return { valid: true };
}
