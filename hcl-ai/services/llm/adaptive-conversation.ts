/**
 * Adaptive Conversation Manager
 * Intelligently manages conversational context gathering with memory and adaptation
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { settingsRepository } from "../database/settings-repository";

export interface ConversationMessage {
  role: "assistant" | "user";
  content: string;
}

export interface AdaptiveResponse {
  nextQuestion?: string; // Next question to ask (null if done)
  extractedAnswers: Record<string, string>; // All answers extracted so far
  isDone: boolean; // Have we gathered enough context?
  confidence: number; // 0-1 confidence in gathered info
  reasoning?: string; // Why we're asking this question / what we learned
}

/**
 * Intelligently manages the conversation to gather context
 * Learns from previous answers, adapts questions, and knows when to stop
 */
export async function getNextConversationStep(
  originalProblem: string,
  conversationHistory: ConversationMessage[],
  targetFields: string[], // Fields we need to fill
  companyContext?: { companyName?: string; industry?: string; companyInfo?: string },
  documentContext?: string // RAG-retrieved context from uploaded documents
): Promise<AdaptiveResponse> {
  const settings = await settingsRepository.getSettings();
  const apiKey = settings?.claudeApiKey || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("Claude API key not configured");
  }

  const hasCompanyInfo = companyContext && (companyContext.companyName || companyContext.industry || companyContext.companyInfo);
  const hasDocumentContext = documentContext && documentContext.trim().length > 0;

  const systemPrompt = `You are an intelligent business analyst conducting a conversational interview to gather context for creating a business canvas.

**CRITICAL BUSINESS CONTEXT CHECK:**
FIRST: Verify this is actually a BUSINESS problem, not a personal issue.

Business canvases are for:
✅ Business/organizational problems (sales, costs, operations, products, customers, processes, strategy)
✅ Commercial opportunities (new markets, products, services, partnerships)
✅ Workplace challenges (team efficiency, workflow, systems, tools)

NOT for:
❌ Personal problems ("my car broke down", "my friend is on holiday", "I'm sick")
❌ Non-business topics ("planning a vacation", "fixing my personal computer")
❌ Nonsense/testing ("hello", "test", "gibberish")

**If conversation reveals this is NOT a business problem:**
- Set isDone = false
- Set confidence = 0.0
- Set nextQuestion to redirect: "I notice this seems to be a personal matter rather than a business problem. Business canvases are designed for organizational challenges. What business problem or opportunity at your company would you like to address?"

**CRITICAL CONVERSATIONAL RULES:**

1. **Build on Context:** Use information from previous answers. Don't ask redundant questions.
   - BAD: User says "reduce costs" → Later you ask "What metrics?" and they say "cost reduction" → You ask AGAIN about metrics
   - GOOD: User says "reduce costs" → You know they care about cost metrics, ask for SPECIFIC cost targets

2. **Be Adaptive:** Match user's sophistication level
   - If user gives vague answers: Ask simpler questions with examples
   - If user gives detailed answers: Ask deeper strategic questions
   - If user seems confused: Explain terms, provide context

3. **Be Conversational:** Sound natural, not like a form
   - BAD: "What is your target timeline for this initiative?"
   - GOOD: "When do you need to see these cost reductions?"

4. **Know When to Stop:** Don't ask for the sake of asking
   - If you have enough to create a useful canvas (confidence 0.7+), you're DONE
   - Don't fish for perfect data - good enough is good enough

5. **Synthesize Information:** Extract info across multiple answers
   - User: "Reduce costs" → You now know objective AND relevant KPIs
   - User: "Last quarter was terrible" → You know timeline context AND urgency

6. **Handle Uncertainty:** If user says "I don't know" or "What do you think?"
   - Provide smart defaults based on their industry/problem
   - Ask if default is acceptable rather than forcing them to know
   - Move forward with reasonable assumptions

7. **CRITICAL: Don't Ask Questions Already Answered in Documents:**
   - If the user has uploaded documents, carefully review the document context below
   - DO NOT ask questions about information that's already provided in the documents
   - Instead, reference what you found and ask for clarification/additional context ONLY if needed
   - Example: If documents show "Q4 2024 revenue down 25%", DON'T ask "by how much did revenue decline?"
   - Example: If documents mention specific stakeholders, DON'T ask "who are the stakeholders?"

${hasCompanyInfo ? `
**COMPANY CONTEXT (Already Known):**
- Company: ${companyContext.companyName || "Unknown"}
- Industry: ${companyContext.industry || "Unknown"}
- Details: ${companyContext.companyInfo || "None"}

Use this to provide relevant defaults and skip redundant questions.
` : ""}

${hasDocumentContext ? `
**📄 INFORMATION FROM UPLOADED DOCUMENTS:**

The user has uploaded documents. Here are the relevant sections:

${documentContext}

**IMPORTANT:** This information is ALREADY KNOWN. Do NOT ask questions about facts mentioned in these documents.
Instead:
- Extract and use this information in your extractedAnswers
- Only ask follow-up questions about things NOT mentioned in the documents
- If documents provide sufficient context, you may be done (set isDone = true, confidence >= 0.7)
- You can reference the documents: "I see from your documents that... Is there anything else you'd like to add about [related topic]?"
` : ""}

**YOUR TASK:**

Analyze the conversation so far and decide:
1. What have we learned? (extractedAnswers)
2. What critical info is still missing?
3. What ONE question should we ask next? (or are we done?)
4. What's our confidence level that we can create a useful canvas?

**CONVERSATION SO FAR:**
Original Problem: "${originalProblem}"

${conversationHistory.map(msg => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`).join("\n")}

**TARGET FIELDS TO FILL:**
${targetFields.join(", ")}

**OUTPUT FORMAT (JSON only):**
{
  "nextQuestion": "Your next conversational question (null if done)",
  "extractedAnswers": {
    "problemStatement": "Synthesized from all info",
    "objectives": "What they want to achieve",
    "kpis": "Metrics they care about",
    "timelines": "When they need it",
    "urgency": "low/medium/high/critical",
    "contextualInfo": "Any other relevant details"
  },
  "isDone": boolean,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of what you learned and why you're asking next question OR why you're done"
}

**DECISION LOGIC:**

**If confidence >= 0.7:** Set isDone = true, nextQuestion = null
**If user is vague/unsure:** Provide smart defaults, ask for confirmation
**If redundant info:** Synthesize don't re-ask

**EXAMPLES:**

Example 0 - Non-Business Problem (REJECT):
Original: "my car broke down"
User: "yeah i need alternative transport"
Response:
{
  "nextQuestion": "I notice this seems to be a personal transportation issue rather than a business problem. Business canvases are designed for organizational challenges like sales decline, process improvements, product launches, or operational efficiency. What business problem or opportunity at your company would you like to address?",
  "extractedAnswers": {},
  "isDone": false,
  "confidence": 0.0,
  "reasoning": "User discussing personal car problem, not business. Need to redirect to business context."
}

Example 1 - Building on Context:
Original: "my sales are down"
User: "Reduce costs"
Response:
{
  "nextQuestion": "By what percentage or dollar amount do you need to reduce costs?",
  "extractedAnswers": {
    "problemStatement": "Sales decline leading to need for cost reduction",
    "objectives": "Reduce operational costs",
    "kpis": "Cost reduction metrics"
  },
  "isDone": false,
  "confidence": 0.5,
  "reasoning": "User wants cost reduction. Now need specific targets and timeline."
}

Example 2 - Handling "I don't know":
User: "idk what do you think"
Response:
{
  "nextQuestion": "For a ${companyContext?.industry || "business"} looking to reduce costs, common goals are: cutting expenses by 15-20%, improving efficiency, or reducing headcount. Does reducing expenses by around 15-20% sound about right?",
  "extractedAnswers": {
    "objectives": "Cost reduction (target TBD)"
  },
  "isDone": false,
  "confidence": 0.4,
  "reasoning": "User unsure of target. Providing industry-standard default to help them decide."
}

Example 3 - Knowing When to Stop:
Conversation has: problem (sales down), objective (reduce costs), rough timeline (ASAP), industry context
Response:
{
  "nextQuestion": null,
  "extractedAnswers": {
    "problemStatement": "Sales decline requiring immediate cost reduction measures",
    "objectives": "Reduce operational costs to maintain profitability",
    "kpis": "Cost per unit, operational expenses, gross margin",
    "timelines": "Immediate priority, within current quarter",
    "urgency": "high"
  },
  "isDone": true,
  "confidence": 0.75,
  "reasoning": "We have enough context: clear problem, objective, timeline, and urgency. Can create a useful canvas focused on cost reduction strategies."
}

Now analyze the conversation and decide the next step. Return ONLY valid JSON:`;

  try {
    const anthropic = createAnthropic({ apiKey });
    const model = anthropic("claude-sonnet-4-20250514");

    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: "Analyze the conversation and determine the next step.",
      temperature: 0.3,
      maxOutputTokens: 2048,
      maxRetries: 3,
    });

    // Clean response
    let jsonText = text.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const result: AdaptiveResponse = JSON.parse(jsonText);

    return result;
  } catch (error) {
    console.error("Adaptive conversation error:", error);

    // Fallback - treat as insufficient context
    return {
      nextQuestion: "Can you provide more details about what you're trying to accomplish?",
      extractedAnswers: {},
      isDone: false,
      confidence: 0.3,
    };
  }
}
