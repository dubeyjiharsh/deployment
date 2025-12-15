import type { CompanyDocument } from "@/lib/validators/settings-schema";

/**
 * Format documents for inclusion in system prompt
 * Note: Vercel AI SDK doesn't support Anthropic's cache_control,
 * but we keep similar structure for consistency
 */
export function formatDocumentsForSystemPrompt(
  documents: CompanyDocument[],
  promptText: string,
  maxDocLength = 50000
): string {
  const documentsText = `${promptText}

${documents
  .map((doc) => {
    const content =
      doc.content.length > maxDocLength
        ? doc.content.substring(0, maxDocLength) + "\n\n[Document truncated]"
        : doc.content;

    return `### Document: ${doc.filename}\n\n${content}\n\n---`;
  })
  .join("\n\n")}`;

  return documentsText;
}
