import { NextRequest, NextResponse } from "next/server";
import { streamCanvasGeneration } from "@/services/llm/llm-client";
import { canvasGenerationRequestSchema } from "@/lib/validators/canvas-schema";
import { auth } from "@/lib/auth";
import { rateLimitAI } from "@/lib/rate-limit";
import { userRepository } from "@/services/database/user-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/canvas/generate-stream
 * Streams canvas generation with real-time updates
 * MCP tools are now called directly by the LLM as needed
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = rateLimitAI(req);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedRequest = canvasGenerationRequestSchema.parse(body);

    // Import settings repository and DEFAULT_CANVAS_FIELDS
    const { settingsRepository } = await import("@/services/database/settings-repository");
    const { DEFAULT_CANVAS_FIELDS } = await import("@/lib/constants/default-canvas-fields");

    // Fetch global field configuration
    const settings = await settingsRepository.getSettings();
    const storedFields = settings?.canvasFields;

    // Merge stored fields with defaults to ensure new properties (like displayStyle) have values
    type FieldConfig = typeof DEFAULT_CANVAS_FIELDS[number];
    let globalFields: FieldConfig[];
    if (storedFields && storedFields.length > 0) {
      const defaultsMap = new Map(DEFAULT_CANVAS_FIELDS.map(f => [f.fieldKey, f]));
      globalFields = storedFields.map((storedField: FieldConfig) => {
        const defaultField = defaultsMap.get(storedField.fieldKey);
        if (defaultField) {
          return {
            ...defaultField,
            ...storedField,
            displayStyle: storedField.displayStyle || defaultField.displayStyle || "auto",
          };
        }
        return {
          ...storedField,
          displayStyle: storedField.displayStyle || "auto",
        };
      });
    } else {
      globalFields = DEFAULT_CANVAS_FIELDS;
    }
    console.log(`🌐 [STREAM] Loaded ${globalFields.length} global fields (${globalFields.filter(f => f.enabled).length} enabled)`);

    // Get team custom fields
    let teamCustomFields: Array<{ id: string; name: string; instructions: string; enabled: boolean; valueType?: string; displayStyle?: string }> = [];

    const user = await userRepository.getUserById(session.user.id);
    console.log(`🔍 [STREAM] User context loaded (teamId=${user?.teamId || "none"})`);

    if (user?.teamId) {
      const team = await userRepository.getTeamById(user.teamId);
      console.log(`👥 [STREAM] Team found: ${team?.name}, Custom fields: ${team?.customFields?.length || 0}`);

      if (team?.customFields) {
        // Filter for enabled custom fields only
        teamCustomFields = team.customFields.filter((f: { enabled: boolean }) => f.enabled);
        console.log(`✅ [STREAM] Team custom fields: ${teamCustomFields.length}`);
      }
    } else {
      console.log(`❌ [STREAM] User has no team ID`);
    }

    // Merge global fields + team custom fields
    const allFields = [
      ...globalFields,
      ...teamCustomFields.map((tcf) => ({
        id: tcf.id,
        name: tcf.name,
        fieldKey: tcf.name
          .replace(/[^a-zA-Z0-9\s]/g, "")
          .split(/\s+/)
          .map((word, index) =>
            index === 0
              ? word.toLowerCase()
              : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          )
          .join(""),
        instructions: tcf.instructions,
        enabled: tcf.enabled,
        type: 'custom' as const,
        valueType: tcf.valueType || 'string',
        displayStyle: tcf.displayStyle || 'auto',
        supportsDiagram: false,
      }))
    ];


    // Retrieve relevant chunks using RAG (if PostgreSQL is available)
    const fileContents: Array<{ filename: string; content: string }> = [];
    const fieldSpecificContext = new Map<string, string>(); // fieldKey -> context
    const databaseUrl = process.env.DATABASE_URL;

    if (databaseUrl) {
      const { querySimilarChunks } = await import("@/services/rag/embedding-service");

      try {
        // STEP 1: Query field-specific documents for each field that has them
        console.log(`🔍 [STREAM] Checking for field-specific documents...`);
        for (const field of allFields.filter(f => f.enabled)) {
          const fieldDocs = (field as typeof field & { documents?: Array<{ id: string }> }).documents;
          if (fieldDocs && fieldDocs.length > 0) {
            console.log(`📄 [STREAM] Field "${field.name}" has ${fieldDocs.length} document(s), querying RAG...`);

            try {
              const fieldRagResult = await querySimilarChunks(
                validatedRequest.problemStatement + (validatedRequest.contextualInfo ? ` ${validatedRequest.contextualInfo}` : ""),
                {
                  fieldKey: field.fieldKey,
                  limit: 10, // Get top 10 chunks per field
                  similarityThreshold: 0.65,
                  chunksPerDocument: 3,
                }
              );

              if (fieldRagResult.chunks.length > 0) {
                const fieldContext = fieldRagResult.chunks.map(c => c.content).join("\n\n---\n\n");
                fieldSpecificContext.set(field.fieldKey || field.id, fieldContext);
                console.log(`✅ [STREAM] Field "${field.name}": Retrieved ${fieldRagResult.chunks.length} chunks`);
              } else {
                console.warn(`⚠️ [STREAM] Field "${field.name}": No chunks found (documents may have been deleted)`);
              }
            } catch (error) {
              console.error(`❌ [STREAM] Error querying field-specific docs for "${field.name}":`, error);
              // Continue with other fields
            }
          }
        }

        // STEP 2: Query general canvas-level documents
        const hasUploadedFiles = validatedRequest.uploadedFiles && validatedRequest.uploadedFiles.length > 0;

        if (hasUploadedFiles) {
          console.log(`🔍 [STREAM] Using RAG to retrieve chunks from ${validatedRequest.uploadedFiles!.length} uploaded document(s) + global documents`);
        } else {
          console.log(`🔍 [STREAM] Using RAG to retrieve chunks from global documents only`);
        }

        const ragResult = await querySimilarChunks(
          validatedRequest.problemStatement + (validatedRequest.contextualInfo ? ` ${validatedRequest.contextualInfo}` : ""),
          {
            documentIds: hasUploadedFiles ? validatedRequest.uploadedFiles : undefined,
            limit: 20, // Get top 20 chunks for diversity
            similarityThreshold: 0.65, // Slightly lower threshold for more diversity
            chunksPerDocument: 5, // Max 5 chunks per document to ensure all docs represented
          }
        );

        console.log(`📊 [STREAM] RAG found ${ragResult.chunks.length} relevant chunks from general documents`);

        // Group chunks by document/filename for better organization
        const chunksByFile = new Map<string, string[]>();

        for (const chunk of ragResult.chunks) {
          const filename = (chunk.metadata.filename as string) || "Unknown Document";
          if (!chunksByFile.has(filename)) {
            chunksByFile.set(filename, []);
          }
          chunksByFile.get(filename)!.push(chunk.content);
        }

        // Format chunks as "documents"
        for (const [filename, chunks] of chunksByFile.entries()) {
          fileContents.push({
            filename,
            content: chunks.join("\n\n---\n\n"),
          });
        }

        console.log(`📚 [STREAM] Prepared ${fileContents.length} general document(s) + ${fieldSpecificContext.size} field-specific contexts`);
      } catch (error) {
        console.error("❌ [STREAM] RAG query failed:", error);
        console.log("⚠️  [STREAM] Continuing without document context - RAG unavailable");
      }
    } else if (validatedRequest.uploadedFiles && validatedRequest.uploadedFiles.length > 0) {
      // SQLite mode: RAG not available
      console.log(`⚠️  [STREAM] SQLite mode: Document upload not supported (RAG requires PostgreSQL)`);
    }

    // Inject field-specific context into field instructions
    const enrichedFields = allFields.map(field => {
      const fieldKey = field.fieldKey || field.id;
      const context = fieldSpecificContext.get(fieldKey);

      if (context) {
        return {
          ...field,
          instructions: `${field.instructions}\n\n**Field-Specific Reference Documents:**\n${context}`,
        };
      }

      return field;
    });

    // Create a readable stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamCanvasGeneration(
            validatedRequest.problemStatement,
            validatedRequest.contextualInfo,
            enrichedFields,
            fileContents,
            validatedRequest.research
          )) {
            // Check if this is a progress message
            if (chunk.startsWith('__PROGRESS__')) {
              const progressMessage = chunk.replace('__PROGRESS__', '');
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ progress: progressMessage })}\n\n`));
            } else {
              // Regular JSON chunk
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
            }
          }

          // Send completion signal
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in stream endpoint:", error);
    return new Response(
      JSON.stringify({ error: "Failed to start stream" }),
      { status: 500 }
    );
  }
}
