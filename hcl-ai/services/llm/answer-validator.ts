/**
 * Answer Validator Service
 * Validates user answers in conversational context gathering
 * Detects off-topic, vague, or insufficient answers
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { settingsRepository } from "../database/settings-repository";

export interface AnswerValidation {
  isValid: boolean; // Is the answer acceptable?
  confidence: number; // 0-1 confidence in answer quality
  reason?: string; // Why it's invalid (if applicable)
  suggestedFollowUp?: string; // Follow-up question to clarify
  extractedInfo?: string; // Cleaned/extracted relevant info
  containsMultipleAnswers?: boolean; // Did user answer multiple questions?
  additionalAnswers?: Record<string, string>; // Extracted answers for other questions
}

/**
 * Validates a user's answer to a context gathering question
 */
export async function validateAnswer(
  question: string,
  answer: string,
  fieldName: string,
  allQuestions?: Array<{ question: string; field: string }>
): Promise<AnswerValidation> {
  // Quick validation - empty or too short
  if (!answer || answer.trim().length < 1) {
    return {
      isValid: false,
      confidence: 0,
      reason: "Answer is empty",
      suggestedFollowUp: question, // Ask again
    };
  }

  // Get Claude API key
  const settings = await settingsRepository.getSettings();
  const apiKey = settings?.claudeApiKey || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // Fallback - accept answer if we can't validate
    return {
      isValid: true,
      confidence: 0.5,
      extractedInfo: answer.trim(),
    };
  }

  const validationPrompt = `You are validating a user's answer to a question during context gathering for business canvas generation.

**Question Asked:** "${question}"
**Field This Answers:** ${fieldName}
**User's Answer:** "${answer}"

${allQuestions ? `**All Questions in Sequence:**
${allQuestions.map((q, idx) => `${idx + 1}. ${q.question} (field: ${q.field})`).join("\n")}
` : ""}

**YOUR TASK:**
Analyze if the answer is:
1. **Relevant** - Does it actually answer the question asked?
2. **Specific** - Does it provide concrete, actionable information?
3. **Complete** - Is there enough detail, or is it vague?

**EDGE CASES TO DETECT:**

**Off-Topic (confidence: 0.0-0.3):**
- Answer is completely unrelated to question
- Examples:
  - Q: "What metric shows sales are down?" A: "I like pizza"
  - Q: "Over what time period?" A: "The website is blue"

**Vague/Insufficient (confidence: 0.3-0.6):**
- Answer lacks specificity or measurability
- Examples:
  - Q: "By how much have sales declined?" A: "A lot" (need percentage/number)
  - Q: "What is your current revenue?" A: "Not much" (need actual number)
  - Q: "When do you need this done?" A: "Soon" (need actual date/timeframe)

**Acceptable but Needs Clarification (confidence: 0.6-0.8):**
- Answer is relevant but could be more specific
- Examples:
  - Q: "What metric?" A: "Sales" (which sales metric specifically?)
  - Q: "What time period?" A: "Recently" (last week? month? quarter?)

**Good Answer (confidence: 0.8-1.0):**
- Specific, relevant, measurable
- Examples:
  - Q: "What metric?" A: "Monthly recurring revenue"
  - Q: "By how much?" A: "Down 25% or about $50K"
  - Q: "Time period?" A: "Last quarter (Q4 2024)"

**Multi-Answer Detection:**
Check if user answered MULTIPLE questions in one response:
- Example: "Revenue dropped 25% last quarter" answers:
  1. Metric = Revenue
  2. Amount = 25%
  3. Time period = Last quarter

**CONFUSED USER:**
If user seems confused or asks for clarification:
- "I don't understand"
- "What do you mean?"
- "Can you explain?"

**OUTPUT FORMAT (JSON only, no markdown):**
{
  "isValid": boolean,
  "confidence": 0.0-1.0,
  "reason": "Brief explanation if invalid/needs clarification",
  "suggestedFollowUp": "Rephrased or clarifying question (if needed)",
  "extractedInfo": "Cleaned, normalized answer (e.g., '25%' from 'about 25 percent')",
  "containsMultipleAnswers": boolean,
  "additionalAnswers": {
    "fieldName": "extracted value for that field"
  }
}

**EXAMPLES:**

Example 1 - Off-topic:
Q: "What metric shows sales are down?"
A: "I like pizza"
Output:
{
  "isValid": false,
  "confidence": 0.1,
  "reason": "Answer is completely unrelated to the question about sales metrics",
  "suggestedFollowUp": "I need to know which specific metric or number shows that sales are down. For example: revenue, units sold, conversion rate, or customer count?",
  "extractedInfo": null
}

Example 2 - Vague:
Q: "By how much have sales declined?"
A: "A lot"
Output:
{
  "isValid": false,
  "confidence": 0.4,
  "reason": "Answer is too vague - need specific percentage or amount",
  "suggestedFollowUp": "Can you give me a specific percentage or dollar amount? For example: '25%' or '$50,000'",
  "extractedInfo": null
}

Example 3 - Good, multi-answer:
Q: "What specific metric shows sales are down?"
A: "Revenue dropped 25% last quarter"
Output:
{
  "isValid": true,
  "confidence": 1.0,
  "extractedInfo": "Revenue",
  "containsMultipleAnswers": true,
  "additionalAnswers": {
    "kpis": "Revenue declined 25%",
    "timelines": "Last quarter"
  }
}

Example 4 - Confused user:
Q: "What is your current conversion rate?"
A: "What's a conversion rate?"
Output:
{
  "isValid": false,
  "confidence": 0.2,
  "reason": "User doesn't understand the term 'conversion rate'",
  "suggestedFollowUp": "A conversion rate is the percentage of visitors who complete a desired action (like making a purchase). What percentage of your website visitors actually buy something? If you don't know the exact number, a rough estimate is fine.",
  "extractedInfo": null
}

Now analyze the user's answer and return ONLY valid JSON (no markdown, no explanation):`;

  try {
    const anthropic = createAnthropic({ apiKey });
    const model = anthropic("claude-sonnet-4-20250514");

    const { text } = await generateText({
      model,
      system: "You are an answer validation expert. Return ONLY valid JSON with no markdown code blocks.",
      prompt: validationPrompt,
      temperature: 0.2,
      maxOutputTokens: 1024,
      maxRetries: 3,
    });

    // Clean response
    let jsonText = text.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const validation: AnswerValidation = JSON.parse(jsonText);

    return validation;
  } catch (error) {
    console.error("Answer validation failed:", error);

    // Fallback - accept answer if validation fails
    return {
      isValid: true,
      confidence: 0.5,
      extractedInfo: answer.trim(),
    };
  }
}
