/**
 * Parses a text file
 */
function parseText(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

/**
 * Chunks text into smaller segments for context windows
 * @param text - The full text to chunk
 * @param maxChunkSize - Maximum characters per chunk
 * @param overlap - Number of characters to overlap between chunks
 */
export function chunkText(
  text: string,
  maxChunkSize: number = 2000,
  overlap: number = 200
): string[] {
  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + maxChunkSize, text.length);
    const chunk = text.slice(startIndex, endIndex);
    chunks.push(chunk);

    startIndex = endIndex - overlap;

    if (startIndex >= text.length) {
      break;
    }
  }

  return chunks;
}

/**
 * Parses a document based on its MIME type
 */
export async function parseDocument(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  try {
    // Validate MIME type before parsing
    if (!isSupportedMimeType(mimeType)) {
      throw new Error(`Unsupported file type: ${mimeType}. Please use TXT or Markdown files.`);
    }

    // Parse as text (all our supported types are text-based)
    return parseText(buffer);
  } catch (error) {
    console.error("Error parsing document:", error);
    throw new Error(
      `Failed to parse document: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Validates file size
 */
export function validateFileSize(size: number, maxSizeMB: number = 10): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return size <= maxSizeBytes;
}

/**
 * Gets supported MIME types
 */
export function getSupportedMimeTypes(): string[] {
  return [
    "text/plain",
    "text/markdown",
    "text/x-markdown",
  ];
}

/**
 * Checks if a MIME type is supported
 * More permissive validation to handle browser inconsistencies
 */
export function isSupportedMimeType(mimeType: string): boolean {
  // Empty MIME type is allowed - we'll rely on file extension validation as fallback
  if (!mimeType || mimeType === "") {
    return true; // Let file extension validation handle this
  }

  // Allow explicitly whitelisted MIME types
  const allowedTypes = [
    "text/plain",
    "text/markdown",
    "text/x-markdown",
    "application/octet-stream", // Generic binary - common for .md files on some systems
  ];

  return allowedTypes.includes(mimeType.toLowerCase());
}

/**
 * Validates file based on extension
 */
export function isSupportedFileExtension(filename: string): boolean {
  const extension = filename.toLowerCase().split('.').pop();
  return extension === 'txt' || extension === 'md';
}
