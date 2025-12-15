/**
 * Context Validator Service
 * Analyzes user input to determine if there's sufficient context for reliable canvas generation
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { settingsRepository } from "../database/settings-repository";

export interface ClarifyingQuestion {
  question: string;
  field: string; // Which canvas field this helps populate
  required: boolean; // Block generation if unanswered
  options?: string[]; // Suggested answers
}

export interface ContextAnalysis {
  sufficient: boolean; // true if confidence >= 0.7
  confidence: number; // 0-1 overall confidence
  missingContext: string[]; // e.g., ["specific metrics", "budget constraints"]
  clarifyingQuestions: ClarifyingQuestion[];
}

export interface CompanyContext {
  companyName?: string;
  industry?: string;
  companyInfo?: string;
}

/**
 * Analyzes if we have sufficient context to generate a reliable business canvas
 */
export async function analyzeContextSufficiency(
  problemStatement: string,
  contextualInfo?: string,
  uploadedFiles?: { filename: string; content: string }[],
  companyContext?: CompanyContext
): Promise<ContextAnalysis> {
  const hasDocuments = uploadedFiles && uploadedFiles.length > 0;
  const hasContext = contextualInfo && contextualInfo.trim().length > 0;
  const hasCompanyInfo = companyContext && (companyContext.companyName || companyContext.industry || companyContext.companyInfo);

  const validationPrompt = `
Analyze this problem statement and determine if we have sufficient context to generate a reliable business canvas.

**Problem Statement:** "${problemStatement}"
${hasContext ? `**Additional Context:** "${contextualInfo}"` : "**Additional Context:** None provided"}
${hasDocuments ? `**Uploaded Documents:** ${uploadedFiles.length} file(s) provided` : "**Uploaded Documents:** None"}
${hasCompanyInfo ? `
**Company Information (ALREADY KNOWN - DO NOT ASK ABOUT THIS):**
${companyContext.companyName ? `- Company Name: ${companyContext.companyName}` : ""}
${companyContext.industry ? `- Industry: ${companyContext.industry}` : ""}
${companyContext.companyInfo ? `- Company Details: ${companyContext.companyInfo}` : ""}
` : ""}

**CRITICAL BUSINESS CONTEXT CHECK:**
BEFORE evaluating anything else, ask: **Is this a BUSINESS problem?**

Business canvases are for:
✅ Business problems (sales, costs, operations, products, customers, processes)
✅ Organizational issues (team efficiency, workflow, systems, strategy)
✅ Commercial opportunities (new markets, products, services, partnerships)

NOT for:
❌ Personal problems ("my car broke down", "my friend is on holiday")
❌ Non-business topics ("planning a vacation", "fixing my computer")
❌ Random statements ("hello", "testing", "gibberish")

**If this is NOT a business problem:**
- Set confidence = 0.0
- Set sufficient = false
- In clarifyingQuestions, add ONE question that redirects them:
  {
    "question": "This doesn't seem to be a business problem. Business canvases are designed for organizational challenges like sales decline, process improvements, or new product launches. What business problem or opportunity would you like to address?",
    "field": "problemStatement",
    "required": true
  }

**CRITICAL EVALUATION CRITERIA:**

1. **Specificity Test:** Are there concrete facts, numbers, or specific scenarios?
   - ✅ PASS: "Sales dropped 25% last quarter" or "Cart abandonment at 65%"
   - ❌ FAIL: "Sales are down" or "Performance issues"

2. **Scope Clarity:** Do we know WHAT specifically needs to be solved?
   - ✅ PASS: "Checkout process on mobile app"
   - ❌ FAIL: "Website problems" or "improve business"

3. **Quantifiable Data:** Are there ANY numbers, metrics, or measurable goals?
   - ✅ PASS: References to KPIs, budgets, timelines, user counts, percentages
   - ❌ FAIL: Vague descriptions only

4. **Context Richness:** Do we have domain/industry/company details?
   - ✅ PASS: Uploaded documents, specific technologies mentioned, stakeholders identified
   - ❌ FAIL: Generic problem without specifics
${hasCompanyInfo ? `   - ✅ BONUS: Company information is already available (industry, company profile)` : ""}

**SCORING SYSTEM:**
- **0.8-1.0:** Sufficient context - proceed with generation
  - Specific metrics mentioned OR documents uploaded
  - Clear scope and objectives
  - Quantifiable data present
${hasCompanyInfo ? `  - Company context is available (boost confidence by +0.1-0.2)` : ""}

- **0.5-0.7:** Moderate context - ask 2-3 clarifying questions
  - Problem is specific but lacks metrics
  - Some context provided but gaps exist
${hasCompanyInfo ? `  - Company context available but problem needs metrics` : ""}

- **0.0-0.4:** Insufficient context - BLOCK generation, ask 5+ questions
  - Vague problem statement
  - No metrics or measurable data
  - No documents or contextual information
${hasCompanyInfo ? `  - Even with company context, problem is too vague` : ""}

**QUESTION GENERATION RULES:**
- Generate 3-7 targeted, specific questions
- Mark 2-3 as required: true (must be answered to proceed)
- Provide 3-4 answer options where applicable
- Focus on quantifiable data (numbers, metrics, timelines, budgets)
- Be specific: "What's your current monthly revenue?" NOT "Tell me about your business"
${hasCompanyInfo ? `- NEVER ask about company name, industry, or business type - this information is already known (see Company Information section above)` : ""}

**REQUIRED OUTPUT FORMAT:**
Return ONLY valid JSON (no markdown, no code blocks):
{
  "sufficient": boolean,
  "confidence": number,
  "missingContext": string[],
  "clarifyingQuestions": [
    {
      "question": "What specific metric or KPI shows sales are down?",
      "field": "kpis",
      "required": true,
      "options": ["Revenue", "Units sold", "Conversion rate", "Customer count"]
    }
  ]
}

**EXAMPLES:**

Example 1 - Insufficient Context:
Input: "My sales are down"
Output: {
  "sufficient": false,
  "confidence": 0.2,
  "missingContext": ["specific metrics", "time period", "magnitude of decline", "business context"],
  "clarifyingQuestions": [
    {
      "question": "What specific metric shows sales are down?",
      "field": "kpis",
      "required": true,
      "options": ["Total revenue", "Units sold", "Conversion rate", "Average order value"]
    },
    {
      "question": "By how much have sales declined?",
      "field": "kpis",
      "required": true,
      "options": ["0-10%", "10-25%", "25-50%", "More than 50%"]
    },
    {
      "question": "Over what time period?",
      "field": "timelines",
      "required": true,
      "options": ["Last week", "Last month", "Last quarter", "Last year"]
    },
    {
      "question": "What type of business are you in?",
      "field": "problemStatement",
      "required": false,
      "options": ["E-commerce", "SaaS", "Retail", "B2B Services"]
    },
    {
      "question": "What is your current monthly revenue?",
      "field": "budgetResources",
      "required": false
    }
  ]
}

Example 2 - Sufficient Context:
Input: "Our e-commerce checkout abandonment rate is 68%, up from 45% last quarter. Mobile users complain about the 7-step checkout process taking too long."
Output: {
  "sufficient": true,
  "confidence": 0.85,
  "missingContext": [],
  "clarifyingQuestions": []
}

Example 3 - Moderate Context:
Input: "Need to improve our customer support response times"
Output: {
  "sufficient": false,
  "confidence": 0.6,
  "missingContext": ["current metrics", "target metrics", "team size"],
  "clarifyingQuestions": [
    {
      "question": "What is your current average response time?",
      "field": "kpis",
      "required": true,
      "options": ["< 1 hour", "1-4 hours", "4-24 hours", "1+ days"]
    },
    {
      "question": "What is your target response time?",
      "field": "objectives",
      "required": true
    },
    {
      "question": "How many support requests do you receive daily?",
      "field": "kpis",
      "required": false,
      "options": ["< 50", "50-200", "200-500", "500+"]
    }
  ]
}

Now analyze the provided input and return your evaluation as JSON:
  `.trim();

  try {
    // Get Claude API key from settings
    const settings = await settingsRepository.getSettings();
    const apiKey = settings?.claudeApiKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error("Claude API key not configured");
    }

    const systemPrompt = `You are a context analysis expert. Your job is to determine if we have enough information to generate a reliable strategic business canvas, or if we need to ask clarifying questions first.

CRITICAL RULES:
- Return ONLY valid JSON (no markdown code blocks, no explanations)
- If confidence < 0.7, set sufficient = false
- Generate specific, actionable questions
- Focus on quantifiable metrics and data
- Be strict - better to ask than to hallucinate`;

    const anthropic = createAnthropic({ apiKey });
    const model = anthropic("claude-sonnet-4-20250514");

    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: validationPrompt,
      temperature: 0.2,
      maxOutputTokens: 2048,
      maxRetries: 3,
    });

    // Clean response - remove markdown code blocks if present
    let jsonText = text.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const analysis: ContextAnalysis = JSON.parse(jsonText);

    // Validation
    if (typeof analysis.confidence !== "number" || analysis.confidence < 0 || analysis.confidence > 1) {
      throw new Error("Invalid confidence score");
    }

    // Ensure sufficient matches confidence threshold
    analysis.sufficient = analysis.confidence >= 0.7;

    return analysis;
  } catch (error) {
    console.error("Context validation failed:", error);

    // Fallback - if we can't validate, allow generation with warning
    // This ensures the system degrades gracefully
    return {
      sufficient: true,
      confidence: 0.5,
      missingContext: ["Unable to validate context - proceeding with caution"],
      clarifyingQuestions: [],
    };
  }
}
