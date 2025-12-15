import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { settingsRepository } from "@/services/database/settings-repository";
import { buildSystemPrompt } from "@/services/llm/prompts";
import type { LlmProvider } from "@/lib/validators/settings-schema";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import { userRepository } from "@/services/database/user-repository";

const refineChatRequestSchema = z.object({
  canvasId: z.string(),
  fieldKey: z.string(),
  fieldLabel: z.string(),
  currentValue: z.unknown(),
  conversationHistory: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
  userMessage: z.string(),
  fullCanvasContext: z.object({
    title: z.any(),
    problemStatement: z.any(),
    objectives: z.any(),
  }).passthrough(),
  attachments: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    size: z.number(),
    content: z.string(), // Base64 encoded content
  })).optional(),
});

const CLAUDE_MODEL = "claude-sonnet-4-20250514";

/**
 * Helper to decode base64 and extract text content from attachments
 */
function processAttachments(attachments?: Array<{
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
}>): string {
  if (!attachments || attachments.length === 0) {
    return "";
  }

  const processedContent: string[] = [];

  for (const attachment of attachments) {
    try {
      // Decode base64 content
      const decoded = Buffer.from(attachment.content, 'base64').toString('utf-8');

      processedContent.push(`
**File: ${attachment.name}** (${attachment.type})

\`\`\`
${decoded}
\`\`\`
`);
    } catch (error) {
      console.error(`Failed to decode attachment ${attachment.name}:`, error);
      processedContent.push(`
**File: ${attachment.name}** (${attachment.type})
[Unable to process this file type]
`);
    }
  }

  return processedContent.join('\n\n');
}

/**
 * POST /api/canvas/refine-chat
 * Conversational refinement with full context awareness
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Apply authentication and rate limiting
  const { response, session } = await applyApiMiddleware(
    request,
    MIDDLEWARE_PRESETS.AI
  );
  if (response) return response;

  try {
    const body = await request.json();
    const validated = refineChatRequestSchema.parse(body);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await userRepository.getUserById(session.user.id);
    const isAdmin = user?.role === "admin";
    const hasAccess =
      isAdmin || (await userRepository.canUserAccessCanvas(validated.canvasId, session.user.id));

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You don't have access to this canvas" },
        { status: 403 }
      );
    }

    const settings = await settingsRepository.getSettings();
    const baseSystemPrompt = buildSystemPrompt(settings || undefined);
    const provider = (settings?.llmProvider || "claude") as LlmProvider;

    // Build context-aware system prompt with full canvas context for related field detection
    const fullCanvasJson = JSON.stringify({
      title: validated.fullCanvasContext.title,
      problemStatement: validated.fullCanvasContext.problemStatement,
      objectives: validated.fullCanvasContext.objectives,
      // Include all other fields that might be affected
      ...(validated.fullCanvasContext as Record<string, unknown>),
    }, null, 2);

    const systemPrompt = `${baseSystemPrompt}

## Conversational Refinement Task

You are helping the user refine the **${validated.fieldLabel}** field in their business canvas.

**Current Value:**
${JSON.stringify(validated.currentValue, null, 2)}

**Full Canvas Context:**
${fullCanvasJson}

## Instructions:
1. Have a natural conversation with the user about refining this field
2. Ask clarifying questions when needed
3. Suggest specific improvements based on the canvas context
4. **NEVER apply changes without explicit user approval** - always present suggestions and wait for confirmation
5. Use the full canvas context to ensure coherence across all fields
6. Be concise but helpful - aim for 2-4 sentences per response
7. **IMPORTANT:** If updating this field affects other related fields, you MUST suggest those changes too

## How to handle suggestions:
- When suggesting improvements, present them as options WITHOUT code blocks
- Ask the user if they like the suggestion or want alternatives
- ONLY provide a code block when the user explicitly approves (e.g., "yes", "apply it", "looks good", "use that")
- The code block signals you're ready to update the field

## Detecting Related Field Changes:
When refining this field, consider if changes should be made to related fields:
- **Key Features** affects **Data Dependencies**, **Technical Architecture**
- **Objectives** affects **KPIs**, **Success Criteria**, **Metrics**
- **Timeline** affects **Budget Resources**, **Risks**, **Dependencies**
- **Budget Resources** affects **ROI Analysis**, **Stakeholder Map**

**IMPORTANT:** When the user approves and you're ready to apply changes:

1. If ONLY updating the current field, return a JSON code block like this:
\`\`\`json
{
  "primaryField": "The new value for ${validated.fieldLabel}"
}
\`\`\`

2. If ALSO suggesting changes to related fields, return a JSON code block like this:
\`\`\`json
{
  "primaryField": "The new value for ${validated.fieldLabel}",
  "relatedFieldSuggestions": {
    "fieldKey1": {
      "fieldLabel": "Field Label",
      "suggestedValue": "The suggested new value",
      "reason": "Brief explanation why this change is needed"
    },
    "fieldKey2": {
      "fieldLabel": "Another Field",
      "suggestedValue": "Another suggested value",
      "reason": "Why this should be updated"
    }
  }
}
\`\`\`

Example conversation flow:
User: "Can we make this punchier?"
You: "How about: 'Transforming Gap Inc.'s Online Experience'? It's more direct and impactful. I also notice this might affect your Key Features - should we review those too? Would you like me to apply these changes?"
User: "Yes, apply it"
You: "Perfect! I'll update the fields now.
\`\`\`json
{
  "primaryField": "Transforming Gap Inc.'s Online Experience",
  "relatedFieldSuggestions": {
    "keyFeatures": {
      "fieldLabel": "Key Features",
      "suggestedValue": ["Real-time inventory visibility", "Seamless omnichannel experience"],
      "reason": "Updated to align with the new punchier title focus"
    }
  }
}
\`\`\`"

**DO NOT** use code blocks until the user explicitly approves your suggestion!

Remember: You're refining "${validated.fieldLabel}" in the context of solving "${validated.fullCanvasContext.problemStatement?.value || 'the problem'}"`;

    console.log(`Refining ${validated.fieldKey} with conversation history of ${validated.conversationHistory.length} messages using ${provider}`);

    // Process attachments if any
    const attachmentContent = processAttachments(validated.attachments);

    let assistantMessage: string;

    if (provider === "claude") {
      const apiKey = settings?.claudeApiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("Claude API key not configured");
      }

      const { anthropic } = await import("@ai-sdk/anthropic");
      const { generateText } = await import("ai");

      const claudeMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
      for (const msg of validated.conversationHistory) {
        claudeMessages.push({ role: msg.role, content: msg.content });
      }

      // Append attachment content to user message if present
      const fullUserMessage = attachmentContent
        ? `${validated.userMessage}\n\n## Attached Files\n\n${attachmentContent}`
        : validated.userMessage;

      claudeMessages.push({ role: "user", content: fullUserMessage });

      const model = anthropic(CLAUDE_MODEL);

      const { text } = await generateText({
        model,
        system: systemPrompt,
        messages: claudeMessages,
        temperature: 0.7,
        maxOutputTokens: 1024,
      });

      assistantMessage = text;
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    // Check if the response contains a final refined value
    // Look for code blocks or explicit confirmation patterns
    const codeBlockMatch = assistantMessage.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    let refinedValue = null;
    let relatedFieldSuggestions: Record<string, {
      fieldLabel: string;
      suggestedValue: unknown;
      reason: string;
    }> | null = null;

    if (codeBlockMatch) {
      try {
        // Try to parse as JSON first
        const parsed = JSON.parse(codeBlockMatch[1]);

        // Check if it's the new format with primaryField and optional relatedFieldSuggestions
        if (parsed && typeof parsed === 'object' && 'primaryField' in parsed) {
          refinedValue = parsed.primaryField;
          relatedFieldSuggestions = parsed.relatedFieldSuggestions || null;
        }
        // If it's the old format with "value", "evidence", "confidence"
        else if (parsed && typeof parsed === 'object' && 'value' in parsed) {
          refinedValue = parsed.value;
        }
        // Otherwise use the whole parsed object
        else {
          refinedValue = parsed;
        }
      } catch {
        // If not JSON, use as plain text
        refinedValue = codeBlockMatch[1].trim();
      }
    } else if (assistantMessage.toLowerCase().includes("i'll update the field")) {
      // Extract value after confirmation phrase
      const lines = assistantMessage.split("\n");
      const valueLines = lines.slice(1).join("\n").trim();
      if (valueLines) {
        refinedValue = valueLines;
      }
    }

    return NextResponse.json({
      message: assistantMessage,
      refinedValue,
      hasRefinedValue: refinedValue !== null,
      relatedFieldSuggestions,
      hasRelatedSuggestions: relatedFieldSuggestions !== null && Object.keys(relatedFieldSuggestions).length > 0,
    });
  } catch (error) {
    console.error("Error in refine-chat:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to process chat refinement" },
      { status: 500 }
    );
  }
}
