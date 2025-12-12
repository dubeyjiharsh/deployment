/**
 * Adaptive Conversation API
 * Intelligently determines next question based on conversation history
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getNextConversationStep } from "@/services/llm/adaptive-conversation";
import { settingsRepository } from "@/services/database/settings-repository";

const conversationMessageSchema = z.object({
  role: z.enum(["assistant", "user"]),
  content: z.string(),
});

const adaptiveConversationSchema = z.object({
  originalProblem: z.string(),
  conversationHistory: z.array(conversationMessageSchema),
  targetFields: z.array(z.string()),
  uploadedFiles: z.array(z.string()).optional(), // Document IDs for RAG
});

export async function POST(req: NextRequest) {
  try {
    // Authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request
    const body = await req.json();
    const { originalProblem, conversationHistory, targetFields, uploadedFiles } =
      adaptiveConversationSchema.parse(body);

    // Get company settings
    const settings = await settingsRepository.getSettings();
    const companyContext = {
      companyName: settings?.companyName,
      industry: settings?.industry,
      companyInfo: settings?.companyInfo,
    };

    // Retrieve RAG context if documents were uploaded
    let documentContext: string | undefined;

    if (uploadedFiles && uploadedFiles.length > 0) {
      const databaseUrl = process.env.DATABASE_URL;

      if (databaseUrl) {
        try {
          const { querySimilarChunks } = await import("@/services/rag/embedding-service");

          console.log(`🔍 [ADAPTIVE] Retrieving RAG context from ${uploadedFiles.length} document(s)`);

          // Query relevant chunks based on problem + conversation
          const conversationText = conversationHistory
            .map(msg => msg.content)
            .join(" ");

          const ragResult = await querySimilarChunks(
            `${originalProblem} ${conversationText}`,
            {
              documentIds: uploadedFiles,
              limit: 15, // Get top 15 chunks
              similarityThreshold: 0.65,
              chunksPerDocument: 5,
            }
          );

          console.log(`📊 [ADAPTIVE] Found ${ragResult.chunks.length} relevant chunks`);

          // Format chunks into a readable context
          if (ragResult.chunks.length > 0) {
            const chunksByFile = new Map<string, string[]>();

            for (const chunk of ragResult.chunks) {
              const filename = (chunk.metadata.filename as string) || "Unknown Document";
              if (!chunksByFile.has(filename)) {
                chunksByFile.set(filename, []);
              }
              chunksByFile.get(filename)!.push(chunk.content);
            }

            // Build document context summary
            const contextParts: string[] = [];
            for (const [filename, chunks] of chunksByFile.entries()) {
              contextParts.push(`**From ${filename}:**\n${chunks.join("\n\n")}`);
            }

            documentContext = contextParts.join("\n\n---\n\n");
          }
        } catch (error) {
          console.error("❌ [ADAPTIVE] RAG query failed:", error);
          console.log("⚠️  [ADAPTIVE] Continuing without document context");
        }
      }
    }

    // Get next conversation step
    const response = await getNextConversationStep(
      originalProblem,
      conversationHistory,
      targetFields,
      companyContext,
      documentContext
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("Adaptive conversation error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to process conversation" },
      { status: 500 }
    );
  }
}
