import type { CompanySettings } from "@/lib/validators/settings-schema";

/**
 * Base system prompt for business canvas generation
 */
const BASE_SYSTEM_PROMPT = `You are an expert strategic business analyst with deep industry knowledge. Your role is to create insightful, comprehensive business canvases that demonstrate strategic thinking and industry best practices.

## Core Principles

1. **Document Data Takes Priority**: When reference documents are provided:
   - ALWAYS extract numerical data EXACTLY as stated (budgets, timelines, targets, KPIs)
   - NEVER estimate or infer numbers when explicit data exists in documents
   - Look for financial data, investment allocations, revenue targets, and cost breakdowns
   - Identify ALL strategic initiatives mentioned across documents, even if scattered
   - Connect related information across multiple documents
   - Only use industry knowledge to fill gaps where documents are silent

2. **Confidence Scoring & Anti-Hallucination**: Assign confidence scores (0-1) based on:
   - 0.9-1.0: Explicitly stated in uploaded documents or user input (HIGHEST PRIORITY)
   - 0.7-0.8: Strongly implied by document context
   - 0.5-0.6: Reasonable inference from documents or industry best practices
   - 0.3-0.4: Weak inference from generic industry knowledge
   - 0.0-0.2: No evidence available, requires user input

   **CRITICAL ANTI-HALLUCINATION RULES:**
   - If confidence < 0.7 for a field, use the "insufficient_context" state
   - NEVER generate specific numbers (percentages, dollar amounts, dates) with confidence < 0.7
   - NEVER use industry averages for company-specific fields (KPIs, budgets, timelines)
   - NEVER fabricate stakeholder names, technical stacks, or resource requirements
   - Prefer document-based evidence (0.9-1.0) over industry inferences (0.5-0.6)

   **INSUFFICIENT CONTEXT STATE:**
   When you cannot generate a field with confidence >= 0.7, use this structure:
   {
     "value": null,
     "confidence": <actual_score>,
     "evidence": [],
     "state": "insufficient_context",
     "requiredInfo": ["specific data needed"],
     "suggestedQuestions": ["What is your current...?", "What is your target...?"]
   }

   **IMPORTANT:** It's OKAY to have many fields in insufficient_context state.
   Better to leave fields empty than to fabricate data. User can refine later.

   **ALLOWED LOW-CONFIDENCE GENERATION (confidence 0.5-0.6):**
   ✅ General recommendations (e.g., "Consider A/B testing")
   ✅ Framework suggestions (e.g., "Use OKR framework")
   ✅ Risk categories (e.g., "Technical debt risk" without specific impact estimates)
   ✅ Generic best practices

   **FORBIDDEN LOW-CONFIDENCE GENERATION:**
   ❌ Specific KPI targets (e.g., "Increase conversion to 4.5%")
   ❌ Budget estimates (e.g., "$500K for implementation")
   ❌ Timeline dates (e.g., "Q2 2025 launch")
   ❌ Stakeholder names (e.g., "CTO John Smith")
   ❌ Technology stacks (e.g., "Use React + Node.js")

3. **Strategic Thinking**: Extract strategic priorities from documents first, then enrich with industry context

4. **Valid JSON**: ONLY output valid JSON matching the schema provided. No additional text.

5. **Actionable Insights**: Provide specific, detailed recommendations based on document evidence

6. **Visual Diagrams**: Generate Mermaid diagrams when they add value:
   - **Stakeholder Maps**: Use graph/flowchart to show relationships and influence
   - **Technical Architecture**: Use graph/C4 diagrams for system architecture
   - **Timelines**: Use Gantt charts for project milestones
   - **Dependencies**: Use graph diagrams for dependency relationships
   - **Solution Actions**: Use flowcharts for action sequences
   - Include diagram in the optional "diagram" field using valid Mermaid syntax

## Field Guidelines - Be Specific and Strategic

**When Reference Documents Are Provided:**
- **FIRST**: Scan all documents for explicit data (budgets, dates, KPIs, targets, stakeholders, technologies)
- **THEN**: Organize and synthesize this data into the canvas structure
- **FINALLY**: Fill any remaining gaps with industry-informed insights

**Field-Specific Extraction Rules:**

- **Problem Statement**: Extract metrics and business impact from documents; include exact numbers mentioned
- **Objectives**: Extract stated goals and targets EXACTLY as specified in documents; cite document evidence
- **OKRs**: Convert objectives into measurable OKRs (Objectives and Key Results); each objective should have 3-4 key results with specific, measurable targets
- **KPIs**: Look for numerical targets (e.g., "conversion: 2.1% → 4.5%"); extract ALL metrics mentioned across documents
- **Budget/Resources**: Extract EXACT budget numbers, investment allocations, and cost breakdowns; NEVER estimate when data exists
- **Timelines**: Extract specific dates, quarters, milestones from documents; use document-based timelines over generic estimates. CRITICAL: All dates must be in the future relative to the current date provided in the system prompt. When documents mention quarters without years, infer the next occurrence of that quarter.
- **Urgency**: Base on revenue impact, competitive threats, or deadlines mentioned in documents
- **Key Features**: Extract specific capabilities, technologies, and features mentioned; note vendor names if specified
- **Dependencies**: Extract named systems, platforms, and vendors from documents (e.g., "Salesforce Customer 360", "Google Cloud Platform")
- **Data Dependencies**: Extract specific data sources, APIs, and integration points mentioned
- **Stakeholder Map**: Extract named stakeholders, roles, and organizational structure from documents
- **Technical Architecture**: Extract mentioned technologies, platforms, and architectural patterns
- **Risks**: Prioritize real issues documented in customer feedback or project documents over generic risks
- **Strategic Priorities**: Identify ALL strategic initiatives mentioned across documents, even if in different sections (e.g., Gen Z growth, social commerce, digital transformation)
- **Alignment**: Extract stated business strategy, market positioning, and long-term goals from documents
- **Solution**: Base recommendations on capabilities and approaches mentioned in documents; add strategic depth

## Output Format

CRITICAL: Output ONLY valid JSON. Do NOT include markdown fences (no \`\`\`json or \`\`\`).

Each field in your output MUST follow this structure:
{
  "fieldKey": {
    "value": <value matching the field's specified type - string, array, or object>,
    "evidence": [
      {"snippet": "exact quote from source", "source": "user_input or upload:filename", "confidence": 0.9}
    ],
    "confidence": 0.0-1.0,
    "diagram": "optional mermaid diagram if field supports it"
  }
}

**Value Type Rules (ABSOLUTE - no exceptions):**
- If a field's type is "string" → "value" MUST be a plain text string
- If a field's type is "array" → "value" MUST be a JSON array like ["item1", "item2"]
- If a field's type is "object" → "value" MUST be a JSON object like {"key": "value"}

**Insufficient Context State:**
When confidence < 0.7, use this structure:
{
  "fieldKey": {
    "value": null,
    "confidence": <actual_score>,
    "evidence": [],
    "state": "insufficient_context",
    "requiredInfo": ["what data is needed"],
    "suggestedQuestions": ["Questions to ask user"]
  }
}

The specific fields to generate and their types will be provided in the user prompt.

## Evidence Format Rules

IMPORTANT: Each evidence item MUST be an object with these fields:
- snippet: String - The EXACT text from the source that supports your extraction (copy verbatim, include numbers)
- source: String - Where it came from:
  - "upload:filename" - for data from uploaded documents (HIGHEST PRIORITY)
  - "user_input" - for data from the problem statement
  - "mcp:server_name" - for data from MCP tools
- confidence: Number between 0-1 - How confident you are in this evidence

**Evidence Priority Order:**
1. upload:filename (explicit document data) - confidence 0.9-1.0
2. mcp:server_name (real-time system data) - confidence 0.8-1.0
3. user_input (problem statement) - confidence 0.8-0.9
4. Industry knowledge (when no documents) - confidence 0.3-0.6

NEVER use simple strings for evidence. Always use the full object structure.

**Numerical Data Evidence:**
When extracting budgets, KPIs, or targets from documents, your evidence snippet MUST include the exact number:
- ✅ GOOD: {"snippet": "Total investment: $285M allocated across technology ($98M), customer experience ($89M), omnichannel ($52M), marketing tech ($32M), and operations ($14M)", "source": "upload:strategic-goals-2024.md", "confidence": 1.0}
- ❌ BAD: {"snippet": "significant investment in digital transformation", "source": "upload:strategic-goals-2024.md", "confidence": 0.7}

## MCP Data Integration

When MCP (Model Context Protocol) data is provided:
- **MANDATORY**: Use it to enrich your analysis with real-world data
- **CRITICAL**: ALWAYS cite MCP sources in evidence with EXACT format: "mcp:server_name" (e.g., "mcp:PostgreSQL")
- Assign confidence based on data freshness and relevance (typically 0.8-1.0 for direct data)
- Prioritize MCP data over speculation when available
- Use MCP metrics, documents, and resources to validate assumptions
- ANY data, metrics, or insights derived from tool calls MUST be cited as "mcp:server_name" in evidence

## Constraints on Speculation

- NEVER fabricate data, metrics, or capabilities not mentioned in evidence
- Solution recommendations must have evidence confidence ≥ 0.7
- If uncertain (confidence < 0.5), explicitly state "Requires validation"
- For demo/synthetic data, acknowledge it's for illustration purposes
- Do NOT invent features or capabilities unless strongly supported by evidence`;

/**
 * Industry-specific guidance for canvas generation
 */
const INDUSTRY_GUIDANCE: Record<string, string> = {
  ecommerce: `
### E-commerce Industry Focus

**KPIs to prioritize:**
- Cart abandonment rate (target: <40%)
- Conversion rate (CR)
- Average order value (AOV)
- Customer lifetime value (CLV)
- Customer acquisition cost (CAC)
- Return rate

**Common risks:**
- Payment gateway integration issues
- Inventory synchronization problems
- Checkout friction and complexity
- Fraud and chargebacks
- Mobile optimization challenges

**Typical features:**
- Product catalog management
- Shopping cart functionality
- Payment processing integration
- Order management system
- Customer account management
- Search and filtering

**Data dependencies:**
- Web analytics (GA4, Adobe Analytics)
- CRM systems (Klaviyo, HubSpot)
- Inventory management systems
- Payment gateways (Stripe, PayPal)
- Shipping providers`,

  saas: `
### SaaS Industry Focus

**KPIs to prioritize:**
- Monthly/Annual Recurring Revenue (MRR/ARR)
- Churn rate (target: <5% monthly)
- Trial-to-paid conversion rate
- Daily/Monthly Active Users (DAU/MAU)
- Net Promoter Score (NPS)
- Customer Acquisition Cost (CAC)
- Lifetime Value (LTV)
- Feature adoption rate

**Common risks:**
- Poor onboarding experience leading to trial abandonment
- Technical debt affecting scalability
- Feature complexity overwhelming users
- Integration challenges with other tools
- Security and compliance concerns

**Typical features:**
- User onboarding flows
- In-app messaging and tutorials
- Feature usage analytics
- Subscription management
- Role-based access control
- API integrations

**Data dependencies:**
- Product analytics (Mixpanel, Amplitude)
- User behavior tracking
- Billing systems (Stripe, Chargebee)
- Support ticketing systems
- Customer success platforms`,

  retail: `
### Retail Industry Focus

**KPIs to prioritize:**
- Same-store sales growth
- Foot traffic and conversion rate
- Inventory turnover ratio
- Gross margin return on investment (GMROI)
- Sales per square foot
- Customer retention rate
- Average transaction value

**Common risks:**
- Supply chain disruptions
- Seasonal demand fluctuations
- Inventory management challenges
- Staff turnover and training
- Competition from e-commerce

**Typical features:**
- Point of sale (POS) system integration
- Inventory management
- Customer loyalty programs
- Staff scheduling
- Multi-location management
- Omnichannel capabilities

**Data dependencies:**
- POS systems
- Inventory databases
- Customer databases
- Supply chain management systems
- Store management systems`,

  manufacturing: `
### Manufacturing Industry Focus

**KPIs to prioritize:**
- Overall Equipment Effectiveness (OEE)
- Production cycle time
- First-pass yield rate
- Defect rate
- On-time delivery rate
- Inventory turnover
- Cost per unit

**Common risks:**
- Equipment downtime and maintenance
- Supply chain bottlenecks
- Quality control issues
- Regulatory compliance
- Skills shortage

**Typical features:**
- Production scheduling
- Quality management systems
- Preventive maintenance tracking
- Supply chain visibility
- Real-time monitoring dashboards
- Traceability systems

**Data dependencies:**
- Manufacturing execution systems (MES)
- Enterprise resource planning (ERP)
- SCADA and IoT sensors
- Quality management systems
- Supplier databases`,

  healthcare: `
### Healthcare Industry Focus

**KPIs to prioritize:**
- Patient satisfaction scores
- Readmission rates
- Average wait time
- Bed occupancy rate
- Clinical outcomes
- Cost per patient
- Revenue cycle metrics

**Common risks:**
- Regulatory compliance (HIPAA, GDPR)
- Data security and privacy
- Interoperability challenges
- Staff burnout
- Insurance claim denials

**Typical features:**
- Electronic health records (EHR) integration
- Patient portal
- Appointment scheduling
- Telehealth capabilities
- Billing and claims management
- Clinical decision support

**Data dependencies:**
- EHR systems
- Practice management systems
- Lab and imaging systems
- Insurance verification systems
- Patient feedback systems`,

  financial_services: `
### Financial Services Industry Focus

**KPIs to prioritize:**
- Assets under management (AUM)
- Customer acquisition cost
- Net interest margin
- Return on equity (ROE)
- Loan default rate
- Digital adoption rate
- Compliance incident rate

**Common risks:**
- Regulatory compliance (SEC, FINRA)
- Cybersecurity threats
- Fraud detection challenges
- Legacy system constraints
- Customer trust and reputation

**Typical features:**
- Account management
- Transaction processing
- Fraud detection systems
- Regulatory reporting
- Customer verification (KYC)
- Portfolio management

**Data dependencies:**
- Core banking systems
- Transaction databases
- Risk management systems
- Compliance monitoring tools
- Customer relationship management`,

  logistics: `
### Logistics & Supply Chain Industry Focus

**KPIs to prioritize:**
- On-time delivery rate
- Order accuracy rate
- Freight cost per unit
- Warehouse capacity utilization
- Inventory accuracy
- Damage/loss rate
- Average delivery time

**Common risks:**
- Transportation delays
- Inventory inaccuracies
- Warehouse capacity constraints
- Driver shortage
- Fuel cost volatility

**Typical features:**
- Route optimization
- Real-time tracking
- Warehouse management
- Load planning
- Proof of delivery
- Fleet management

**Data dependencies:**
- Transportation management systems (TMS)
- Warehouse management systems (WMS)
- GPS/telematics systems
- Order management systems
- Supplier and carrier databases`,

  telecommunications: `
### Telecommunications Industry Focus

**KPIs to prioritize:**
- Network uptime (target: 99.9%+)
- Customer churn rate
- Average revenue per user (ARPU)
- Network capacity utilization
- Customer support resolution time
- Data usage growth
- Net Promoter Score

**Common risks:**
- Network infrastructure failures
- Cybersecurity threats
- Regulatory compliance
- Technology obsolescence
- Competition and pricing pressure

**Typical features:**
- Network monitoring
- Customer self-service portal
- Billing and subscription management
- Service provisioning automation
- Network capacity planning
- Fault detection and resolution

**Data dependencies:**
- Network management systems
- Customer relationship management
- Billing systems
- Service assurance platforms
- Usage analytics`,

  energy: `
### Energy & Utilities Industry Focus

**KPIs to prioritize:**
- System reliability (SAIDI, SAIFI)
- Energy efficiency ratio
- Peak demand management
- Customer satisfaction
- Renewable energy percentage
- Grid stability metrics
- Cost per kilowatt-hour

**Common risks:**
- Infrastructure aging
- Extreme weather events
- Regulatory compliance
- Grid security threats
- Demand forecasting accuracy

**Typical features:**
- Smart meter integration
- Demand response systems
- Outage management
- Asset maintenance tracking
- Energy usage analytics
- Renewable integration management

**Data dependencies:**
- SCADA systems
- Smart meter data
- Weather monitoring systems
- Asset management systems
- Customer billing systems`,

  other: `
### General Business Focus

Apply standard business analysis principles:
- Focus on measurable outcomes
- Identify clear stakeholders
- Consider technical and organizational constraints
- Assess alignment with strategic objectives
- Balance short-term wins with long-term vision`,
};

/**
 * Builds enhanced system prompt with company and industry context
 */
export function buildSystemPrompt(settings?: CompanySettings): string {
  let prompt = BASE_SYSTEM_PROMPT;

  // Add current date context
  const currentDate = new Date();
  const formattedDate = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
  const readableDate = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  prompt += `\n\n## Current Date Context\n\n`;
  prompt += `**Today's Date:** ${readableDate} (${formattedDate})\n`;
  prompt += `**Year:** ${currentDate.getFullYear()}\n`;
  prompt += `**Quarter:** Q${Math.floor(currentDate.getMonth() / 3) + 1}\n\n`;
  prompt += `**CRITICAL FOR TIMELINES:**\n`;
  prompt += `- ALL timeline dates MUST be in the FUTURE (after ${formattedDate})\n`;
  prompt += `- When user mentions "Q1", "Q2", etc. without a year, assume the NEXT occurrence of that quarter\n`;
  prompt += `- When user mentions relative dates like "in 3 months" or "by end of year", calculate from ${formattedDate}\n`;
  prompt += `- NEVER generate dates in the past unless explicitly referencing historical context\n`;
  prompt += `- Default project start dates should be at least 1-2 weeks from today to allow for planning\n`;

  if (settings?.companyName || settings?.industry) {
    prompt += `\n## Company Context\n`;

    if (settings.companyName) {
      prompt += `\n**Company:** ${settings.companyName}\n`;
    }

    if (settings.industry) {
      prompt += `**Industry:** ${settings.industry}\n`;
      const industryGuidance = INDUSTRY_GUIDANCE[settings.industry] || INDUSTRY_GUIDANCE.other;
      prompt += industryGuidance;
    }

    if (settings.companyInfo) {
      prompt += `\n**Company Profile:**\n${settings.companyInfo}\n`;
    }
  }

  return prompt;
}

/**
 * Legacy export for backward compatibility
 */
export const SYSTEM_PROMPT = BASE_SYSTEM_PROMPT;

/**
 * Few-shot examples for the model
 */
export const FEW_SHOT_EXAMPLES = [
  {
    input: `Problem: Our e-commerce checkout process has a 65% cart abandonment rate. Customers complain about too many steps and slow loading times. We need to improve conversion by Q2 2025.`,
    output: {
      title: {
        value: "E-commerce Checkout Optimization",
        evidence: [
          {
            snippet: "e-commerce checkout process",
            source: "user_input",
            confidence: 1.0,
          },
        ],
        confidence: 0.95,
      },
      problemStatement: {
        value:
          "High cart abandonment rate (65%) due to complex multi-step checkout and performance issues",
        evidence: [
          {
            snippet:
              "65% cart abandonment rate. Customers complain about too many steps and slow loading times",
            source: "user_input",
            confidence: 1.0,
          },
        ],
        confidence: 1.0,
      },
      objectives: {
        value: [
          "Reduce cart abandonment rate from 65% to below 40%",
          "Simplify checkout to 3 steps or fewer",
          "Improve page load time to under 2 seconds",
        ],
        evidence: [
          {
            snippet: "65% cart abandonment rate",
            source: "user_input",
            confidence: 0.9,
          },
          {
            snippet: "too many steps",
            source: "user_input",
            confidence: 0.9,
          },
        ],
        confidence: 0.85,
      },
      kpis: {
        value: [
          "Cart abandonment rate < 40%",
          "Conversion rate increase by 25%",
          "Checkout page load time < 2s",
          "Number of checkout steps reduced to 3",
        ],
        evidence: [
          {
            snippet: "65% cart abandonment rate",
            source: "user_input",
            confidence: 0.85,
          },
        ],
        confidence: 0.8,
      },
      urgency: {
        value: "high",
        evidence: [
          {
            snippet: "need to improve conversion by Q2 2025",
            source: "user_input",
            confidence: 0.85,
          },
        ],
        confidence: 0.85,
      },
      timelines: {
        value: {
          start: "2025-01-01",
          end: "2025-06-30",
          milestones: [
            {
              name: "Complete checkout redesign",
              date: "2025-04-01",
            },
            {
              name: "Launch optimized checkout",
              date: "2025-06-30",
            },
          ],
        },
        evidence: [
          {
            snippet: "by Q2 2025",
            source: "user_input",
            confidence: 0.9,
          },
        ],
        confidence: 0.75,
      },
      risks: {
        value: [
          "Payment gateway integration complexity",
          "User resistance to UI changes",
          "Technical debt in existing checkout code",
        ],
        evidence: [],
        confidence: 0.5,
      },
      keyFeatures: {
        value: [
          "One-page checkout flow",
          "Guest checkout option",
          "Saved payment methods",
          "Progress indicator",
          "Performance optimization",
        ],
        evidence: [
          {
            snippet: "too many steps",
            source: "user_input",
            confidence: 0.8,
          },
          {
            snippet: "slow loading times",
            source: "user_input",
            confidence: 0.8,
          },
        ],
        confidence: 0.75,
      },
      dependencies: {
        value: [
          "Frontend development team",
          "UX/UI design team",
          "Payment gateway provider",
        ],
        evidence: [],
        confidence: 0.6,
      },
      dataDependencies: {
        value: [
          "Analytics data on checkout funnel",
          "User session recordings",
          "Customer feedback database",
        ],
        evidence: [],
        confidence: 0.65,
      },
      alignmentLongTerm: {
        value:
          "Supports company goal of becoming the market leader in customer experience and increasing annual revenue by 30%",
        evidence: [],
        confidence: 0.5,
      },
      solutionRecommendation: {
        value:
          "Implement a simplified one-page checkout with guest option and optimized performance",
        actions: [
          {
            action: "Conduct user research and A/B testing on checkout prototypes",
            priority: "high",
          },
          {
            action:
              "Refactor checkout backend for better performance and maintainability",
            priority: "high",
          },
          {
            action: "Implement guest checkout and saved payment methods",
            priority: "medium",
          },
          {
            action: "Set up monitoring and analytics for checkout funnel",
            priority: "medium",
          },
        ],
        evidence: [
          {
            snippet: "too many steps and slow loading times",
            source: "user_input",
            confidence: 0.85,
          },
        ],
        confidence: 0.8,
      },
    },
  },
  {
    input: `We're experiencing high churn rate in our SaaS product. Users are leaving after the trial period. Need to improve onboarding.`,
    output: {
      title: {
        value: "SaaS User Onboarding Enhancement",
        evidence: [
          {
            snippet: "SaaS product...improve onboarding",
            source: "user_input",
            confidence: 0.95,
          },
        ],
        confidence: 0.9,
      },
      problemStatement: {
        value:
          "High customer churn after trial period, indicating ineffective user onboarding",
        evidence: [
          {
            snippet: "high churn rate...Users are leaving after the trial period",
            source: "user_input",
            confidence: 1.0,
          },
        ],
        confidence: 0.95,
      },
      objectives: {
        value: [
          "Reduce trial-to-paid conversion churn by 50%",
          "Improve user activation during onboarding",
          "Increase product adoption rate",
        ],
        evidence: [
          {
            snippet: "improve onboarding",
            source: "user_input",
            confidence: 0.85,
          },
        ],
        confidence: 0.75,
      },
      kpis: {
        value: [
          "Trial-to-paid conversion rate increase by 30%",
          "User activation rate (completed key actions) > 60%",
          "Time to first value < 10 minutes",
          "30-day retention rate > 75%",
        ],
        evidence: [],
        confidence: 0.65,
      },
      urgency: {
        value: "high",
        evidence: [
          {
            snippet: "high churn rate",
            source: "user_input",
            confidence: 0.8,
          },
        ],
        confidence: 0.75,
      },
      timelines: {
        value: {
          start: null,
          end: null,
          milestones: [],
        },
        evidence: [],
        confidence: 0.2,
      },
      risks: {
        value: [
          "Poor understanding of user pain points",
          "Complexity of product may hinder quick onboarding",
          "Resource constraints for development",
        ],
        evidence: [],
        confidence: 0.5,
      },
      keyFeatures: {
        value: [
          "Interactive product tour",
          "Step-by-step setup wizard",
          "In-app tutorials and tooltips",
          "Progress tracking for onboarding",
          "Quick-start templates",
        ],
        evidence: [
          {
            snippet: "improve onboarding",
            source: "user_input",
            confidence: 0.7,
          },
        ],
        confidence: 0.7,
      },
      dependencies: {
        value: [
          "Product development team",
          "Customer success team",
          "Analytics infrastructure",
        ],
        evidence: [],
        confidence: 0.6,
      },
      dataDependencies: {
        value: [
          "User behavior analytics",
          "Trial user cohort data",
          "Customer feedback and support tickets",
        ],
        evidence: [],
        confidence: 0.65,
      },
      alignmentLongTerm: {
        value:
          "Supports growth strategy by improving customer lifetime value and reducing acquisition costs",
        evidence: [],
        confidence: 0.55,
      },
      solutionRecommendation: {
        value:
          "Design and implement an interactive onboarding flow with guided tours and progress tracking",
        actions: [
          {
            action: "Analyze user behavior data to identify drop-off points",
            priority: "critical",
          },
          {
            action: "Create user personas and map onboarding journey",
            priority: "high",
          },
          {
            action: "Build interactive product tour with step-by-step guidance",
            priority: "high",
          },
          {
            action: "Implement in-app messaging and tooltips",
            priority: "medium",
          },
        ],
        evidence: [
          {
            snippet: "Users are leaving after the trial period",
            source: "user_input",
            confidence: 0.8,
          },
        ],
        confidence: 0.75,
      },
    },
  },
];

/**
 * Builds the user prompt for canvas generation
 * Now supports global field configuration
 */
export function buildGenerationPrompt(
  problemStatement: string,
  contextualInfo?: string,
  fieldConfiguration?: Array<{
    id: string;
    name: string;
    fieldKey: string;
    instructions: string;
    enabled: boolean;
    includeInGeneration?: boolean;
    valueType?: string;
    displayStyle?: string; // How the field will be rendered: auto, paragraph, bullets, numbered, comma, table
    examples?: string;
    negativePrompt?: string;
    supportsDiagram?: boolean;
    type?: string;
  }>,
  mcpData?: string,
  uploadedFiles?: Array<{ filename: string; content: string }>,
  research?: import("@/lib/validators/canvas-schema").ResearchReport
): string {
  let prompt = `## User Problem Statement\n\n${problemStatement}\n\n`;

  if (contextualInfo) {
    prompt += `## Additional Context\n\n${contextualInfo}\n\n`;
  }

  if (research) {
    prompt += `## Research Findings (Precomputed)\n\n`;
    prompt += `Use these Tavily + RAG findings as high-priority evidence when generating the canvas. Cite these sources where relevant.\n\n`;
    prompt += `### Competitor Analysis\n${research.competitorAnalysis?.content || ""}\n\n`;
    prompt += `### Industry Trends & Internal Applications\n${research.internalApplications?.content || ""}\n\n`;
    prompt += `### Benchmarks\n${research.industryBenchmarks?.content || ""}\n\n`;
    prompt += `### Estimated Impact\n${research.estimatedImpact?.content || ""}\n\n`;
    if (research.strategicImplications?.content) {
      prompt += `### Strategic Implications\n${research.strategicImplications.content}\n\n`;
    }
    prompt += `### Recommendations\n${research.recommendations?.content || ""}\n\n`;
  }

  // Add explicit reminder to use ALL uploaded documents
  if (uploadedFiles && uploadedFiles.length > 1) {
    prompt += `## ⚠️ CRITICAL CITATION REQUIREMENT ⚠️\n\n`;
    prompt += `You have been provided with ${uploadedFiles.length} documents:\n`;
    uploadedFiles.forEach((file, idx) => {
      prompt += `${idx + 1}. ${file.filename}\n`;
    });
    prompt += `\n**MANDATORY**: You MUST cite evidence from **ALL ${uploadedFiles.length} documents**, not just one.\n`;
    prompt += `- Each document provides unique, valuable perspectives\n`;
    prompt += `- Distribute your evidence citations across ALL ${uploadedFiles.length} files\n`;
    prompt += `- If a document lacks relevant info for a field, look harder or use it for context\n`;
    prompt += `- UNACCEPTABLE: Citing only ${uploadedFiles[0].filename} while ignoring the others\n\n`;
  }

  // Add field-specific instructions if configuration is provided
  if (fieldConfiguration && fieldConfiguration.length > 0) {
    // Filter fields for generation: enabled AND includeInGeneration=true
    const enabledFields = fieldConfiguration.filter(f => f.enabled && (f.includeInGeneration ?? true));
    const defaultFields = enabledFields.filter(f => f.type !== 'custom');
    const customFields = enabledFields.filter(f => f.type === 'custom');

    // Add enhanced field instructions for enabled fields
    if (defaultFields.length > 0) {
      prompt += `## Enhanced Field Instructions\n\n`;
      prompt += `The following fields should be generated with these specific guidelines:\n\n`;
      prompt += `**⚠️ IMPORTANT: Value Type ALWAYS takes priority over example format.**\n\n`;

      defaultFields.forEach((field) => {
        const valueType = field.valueType || 'string';
        const typeFormat = valueType === 'string' ? 'plain text string' :
                          valueType === 'array' ? 'JSON array []' :
                          'JSON object {}';

        prompt += `**${field.name} (${field.fieldKey}):**\n`;
        prompt += `- ${field.instructions}\n`;
        prompt += `- **Value Type:** ${valueType} (output MUST be: ${typeFormat})\n`;

        if (field.examples) {
          prompt += `- Examples (content reference only): ${field.examples}\n`;
        }

        if (field.negativePrompt) {
          prompt += `- ⚠️ AVOID: ${field.negativePrompt}\n`;
        }

        if (field.supportsDiagram) {
          prompt += `- 📊 Diagram Support: You MAY include a Mermaid diagram in the "diagram" field if it adds value\n`;
        }

        prompt += `\n`;
      });
    }

    // Add custom fields section
    if (customFields.length > 0) {
      prompt += `## Custom Fields\n\n`;
      prompt += `In addition to standard fields, generate the following custom fields:\n\n`;
      prompt += `**⚠️ CRITICAL FORMAT REQUIREMENTS:**\n`;
      prompt += `- **Value Type and Display Style determine the format** - follow the format guidance for each field exactly\n`;
      prompt += `- String fields: "value" must be a plain text string\n`;
      prompt += `- Array fields with Table display: "value" must be an array of OBJECTS with consistent properties\n`;
      prompt += `- Array fields with List display: "value" must be an array of strings\n`;
      prompt += `- All fields: Include value, evidence, and confidence (0-1)\n\n`;

      customFields.forEach((field, index) => {
        const valueType = field.valueType || 'string';
        const displayStyle = field.displayStyle || 'auto';


        // Determine format guidance based on displayStyle FIRST (takes priority), then valueType
        let typeFormat: string;
        let formatGuidance = '';
        let effectiveType = valueType;

        // TABLE DISPLAY REQUIRES ARRAY OF OBJECTS - override valueType if needed
        if (displayStyle === 'table') {
          effectiveType = 'arrayOfObjects';
          typeFormat = '[{"column1": "value1", "column2": "value2"}, {"column1": "value3", "column2": "value4"}]';
          formatGuidance = `\n\n**🚨 CRITICAL - TABLE FORMAT REQUIRED:**\nThis field MUST be an array of objects for table display. Each object MUST have the SAME properties.\n\n**CORRECT:** [{"role": "CDO", "type": "Approver", "responsibility": "Strategic oversight"}, {"role": "CFO", "type": "Approver", "responsibility": "Budget approval"}]\n\n**WRONG:** ["CDO - Approver - Strategic oversight", "CFO - Approver - Budget approval"]\n\nDO NOT generate an array of strings. Generate an array of OBJECTS.`;
        } else if (valueType === 'string') {
          typeFormat = '"plain text string"';
        } else if (valueType === 'array') {
          // List-style arrays can be simple strings
          typeFormat = '["item1", "item2", ...]';
        } else {
          typeFormat = '{"key": "value", ...}';
        }

        prompt += `### ${index + 1}. ${field.name} (${field.fieldKey})\n`;
        prompt += `**Instructions:** ${field.instructions}\n`;
        prompt += `**Data Format:** "value" MUST be: ${typeFormat}\n`;
        prompt += `**Display Style:** ${displayStyle}${formatGuidance}\n`;

        if (field.examples) {
          prompt += `**Examples (for content reference only, follow Value Type for format):** ${field.examples}\n`;
        }

        if (field.negativePrompt) {
          prompt += `**Avoid:** ${field.negativePrompt}\n`;
        }

        if (field.supportsDiagram) {
          prompt += `**Diagram:** Supported - include Mermaid syntax if helpful\n`;
        }

        prompt += `\n`;
      });
    }

    // Build JSON output schema section
    prompt += `## Output Format - Required Fields\n\n`;
    prompt += `Generate ONLY the following fields in your JSON output:\n\n`;
    prompt += `{\n`;

    const schemaFields = enabledFields
      .sort((a, b) => (a.type === 'custom' ? 1 : -1)) // Default fields first
      .map(field => {
        // Special handling for solutionRecommendation which has a unique schema
        if (field.fieldKey === 'solutionRecommendation') {
          return `  "solutionRecommendation": {
    "value": "string - recommended solution",
    "actions": [
      {"action": "action description", "priority": "low|medium|high|critical", "owner": "optional"},
      ...
    ],
    "evidence": [...],
    "confidence": 0.0-1.0${field.supportsDiagram ? ',\n    "diagram": "optional mermaid"' : ''}
  }`;
        }

        // Standard field schema - use displayStyle to determine array format
        let valueType = 'string';
        if (field.valueType === 'array') {
          // Table display needs array of objects, list display uses simple arrays
          if (field.displayStyle === 'table') {
            valueType = '[{...}, {...}]'; // Array of objects for tables
          } else {
            valueType = '["...", "..."]'; // Array of strings for lists
          }
        } else if (field.valueType === 'object') {
          valueType = '{...}';
        }

        return `  "${field.fieldKey}": {
    "value": ${valueType},
    "evidence": [...],
    "confidence": 0.0-1.0${field.supportsDiagram ? ',\n    "diagram": "optional mermaid"' : ''}
  }`;
      });

    prompt += schemaFields.join(',\n');
    prompt += `\n}\n\n`;
    prompt += `**⚠️ CRITICAL JSON REQUIREMENTS:**\n`;
    prompt += `- Only include fields listed above\n`;
    prompt += `- Do NOT generate fields not in this list\n`;
    prompt += `- **VALUE TYPE AND DISPLAY STYLE ARE ABSOLUTE:**\n`;
    prompt += `  - "string" type → "value": "plain text" (NEVER an array or object)\n`;
    prompt += `  - "array" type with table display → "value": [{"prop1": "...", "prop2": "..."}, ...] (array of OBJECTS with consistent properties)\n`;
    prompt += `  - "array" type with list display → "value": ["item1", "item2", ...] (array of strings)\n`;
    prompt += `  - "object" type → "value": {"key": "value"}\n`;
    prompt += `- Use insufficient_context state if confidence < 0.7\n`;
    prompt += `- Ensure all JSON is properly closed and complete\n\n`;
  }

  if (mcpData) {
    prompt += `## Real-Time Data from MCP Servers\n\n⚡ Use this data to enrich your canvas with real-world information:\n\n${mcpData}\n\n`;
  }

  // Add current date reminder for timeline generation
  const currentDate = new Date();
  const formattedDate = currentDate.toISOString().split('T')[0];
  const currentYear = currentDate.getFullYear();
  const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1;

  prompt += `## IMPORTANT: Current Date Context

📅 **Today is ${formattedDate} (Q${currentQuarter} ${currentYear})**

When generating timelines:
- All dates MUST be in the FUTURE (after ${formattedDate})
- If the user mentions "Q1 2025" and today is already past Q1 2025, interpret it as Q1 2026 or ask for clarification via low confidence
- Calculate relative dates (e.g., "in 3 months", "by year end") from ${formattedDate}
- Default to reasonable future dates (at least 2-4 weeks from today for start dates)

## Task

Generate a complete business canvas in JSON format following these steps:

**STEP 1: EXTRACT FROM REFERENCE DOCUMENTS**
If reference documents are provided in the system prompt:
- Scan ALL documents thoroughly for numerical data (budgets, KPIs, targets, timelines, revenue goals)
- Extract ALL strategic initiatives and priorities mentioned (even if scattered across multiple documents)
- Note specific technologies, vendors, and partners mentioned by name
- Identify real customer pain points and feedback
- Extract exact stakeholder names, roles, and organizational structure
- List all mentioned features, capabilities, and requirements
- Use confidence 0.9-1.0 for all document-extracted data

**STEP 2: SYNTHESIZE & ORGANIZE**
- Organize the extracted data into the canvas structure
- Connect related information from different documents
- Look for strategic themes (e.g., if Gen Z is mentioned multiple times, it's a major initiative)

**STEP 3: FILL GAPS WITH EXPERTISE**
- ONLY after extracting all available document data, use industry knowledge to fill remaining gaps
- Use confidence 0.3-0.6 for industry-inferred data
- Mark fields with insufficient evidence as low confidence

**CRITICAL REQUIREMENTS:**
- Extract explicit information with high confidence (0.9-1.0 for documents, 0.8-0.9 for user input)
- ${mcpData ? "Prioritize MCP data and document data over industry estimates" : "Prioritize document data over industry estimates"}
- Include exact numbers in evidence snippets (budgets, percentages, targets)
- Cite all evidence sources using the format: {"snippet": "exact text", "source": "upload:filename or user_input or mcp:server_name", "confidence": 0.9}
- Never estimate budgets or timelines when explicit data exists in documents`;

  return prompt;
}

/**
 * Builds the prompt for refining a specific field
 */
export function buildRefinementPrompt(
  fieldName: string,
  currentValue: unknown,
  userQuestion: string,
  context?: string,
  mcpData?: string
): string {
  let prompt = `You are refining the "${fieldName}" field of a business canvas.

Current value: ${JSON.stringify(currentValue)}

User instruction: ${userQuestion}

${context ? `Original problem context: ${context}\n` : ""}`;

  if (mcpData) {
    prompt += `\n## Fresh Data from MCP Servers\n\n${mcpData}\n\n`;
  }

  prompt += `\nProvide ONLY a valid JSON response with the updated value. Do not include explanations, markdown, or any other text.

Required JSON format:
{
  "value": "<your updated value here>",
  "evidence": [{"snippet": "relevant text", "source": "user context or mcp:server_name", "confidence": 0.9}],
  "confidence": 0.9
}`;

  return prompt;
}

/**
 * Builds the prompt for expanding a canvas with additional fields
 */
export function buildExpansionPrompt(
  existingCanvas: Record<string, unknown>,
  fieldsToExpand: string[],
  problemStatement: string,
  mcpData?: string
): string {
  let prompt = `You are expanding an existing business canvas with additional strategic fields.

## Original Problem Statement

${problemStatement}

## Existing Canvas Data

${JSON.stringify(existingCanvas, null, 2)}

## Fields to Expand

You need to populate the following additional fields: ${fieldsToExpand.join(", ")}

## Critical Instructions

1. **Use MCP Data When Available**: If MCP data is provided below, prioritize it for evidence-based analysis. Cite MCP sources as "mcp:server_name"
2. **Maintain Consistency**: Ensure new fields align with the existing canvas context
3. **Prevent Hallucination**:
   - ONLY populate fields where you have sufficient evidence (confidence ≥ 0.6)
   - If you cannot reliably populate a field, return it as null with confidence 0.0
   - Do NOT fabricate stakeholder names, budget numbers, or technical details without evidence
4. **Evidence Requirements**:
   - Stakeholder Map: Requires actual stakeholder data from MCP or documents
   - Budget/Resources: Requires financial data or explicit mentions
   - Technical Architecture: Requires technical context or system information
   - Security/Compliance: Requires regulatory context or explicit requirements

${mcpData ? `## Real-Time Data from MCP Servers\n\n⚡ Use this data to populate fields with high confidence:\n\n${mcpData}\n\n` : ""}

## Output Format

CRITICAL: Your response must be ONLY valid JSON. Do NOT include:
- Any explanatory text before or after the JSON
- Markdown code fences (no \`\`\`json or \`\`\`)
- Commentary or reasoning
- Conversational language like "Based on..."

Your entire response must start with { and end with }. Nothing else.

Each field should follow this structure:

{
  "stakeholderMap": {
    "value": [/* array of stakeholders or null if insufficient evidence */],
    "evidence": [{"snippet": "...", "source": "mcp:server_name or upload:filename", "confidence": 0.8}],
    "confidence": 0.8
  },
  "budgetResources": {
    "value": {/* budget object or null */},
    "evidence": [...],
    "confidence": 0.7
  },
  // ... other fields
}

If a field cannot be reliably populated (confidence < 0.6), return:
{
  "fieldName": {
    "value": null,
    "evidence": [],
    "confidence": 0.0
  }
}

## Mermaid Diagram Examples

**CRITICAL MERMAID SYNTAX RULES:**
- Use \\n for line breaks (escaped newline in JSON string)
- NO blank lines in diagram code
- Node IDs must be alphanumeric (no spaces, special chars)
- Labels go in brackets: NodeID[Label Text]
- Always test syntax mentally before including

For stakeholderMap:
"diagram": "graph TD\\n  CEO[CEO]\\n  CTO[CTO]\\n  PM[Product Manager]\\n  DEV[Dev Team]\\n  CEO -.High Influence.-> CTO\\n  CTO -.High Influence.-> PM\\n  PM --> DEV"

For technicalArchitecture:
"diagram": "graph TB\\n  subgraph Frontend\\n    UI[React UI]\\n  end\\n  subgraph Backend\\n    API[API Gateway]\\n    SVC[Services]\\n  end\\n  subgraph Data\\n    DB[(Database)]\\n  end\\n  UI --> API\\n  API --> SVC\\n  SVC --> DB"

For timelines (use actual dates):
"diagram": "gantt\\n  title Project Timeline\\n  dateFormat YYYY-MM-DD\\n  section Phase 1\\n  Planning :2025-01-01, 30d\\n  section Phase 2\\n  Development :2025-02-01, 60d"

**IF UNSURE ABOUT SYNTAX: Leave "diagram" field empty rather than risk syntax errors**

## FINAL REMINDER

Return ONLY the JSON object. No other text. Start your response with { and end with }.`;

  return prompt;
}

/**
 * Builds the prompt for generating user stories from a canvas
 */
export function buildStoriesPrompt(
  canvas: import("@/lib/validators/canvas-schema").BusinessCanvas
): string {
  // Safely extract values with fallbacks
  const title = canvas.title?.value || "Untitled Canvas";
  const problemStatement = canvas.problemStatement?.value || "No problem statement provided";
  const solutionRecommendation = canvas.solutionRecommendation?.value || "No solution provided";
  const keyFeatures = Array.isArray(canvas.keyFeatures?.value) ? canvas.keyFeatures.value.join(", ") : "No features specified";
  const objectives = Array.isArray(canvas.objectives?.value) ? canvas.objectives.value.join(", ") : "No objectives specified";

  // Extract OKRs if available (handle case where okrs.value may be string instead of array)
  const okrsValue = canvas.okrs?.value;
  const okrsArray = Array.isArray(okrsValue) ? okrsValue : [];
  const hasOkrs = okrsArray.length > 0;
  const okrObjectives = okrsArray.filter((okr): okr is Record<string, unknown> =>
    typeof okr === 'object' && okr !== null && 'type' in okr && okr.type === "objective"
  );

  let prompt = `You are a senior product manager and agile expert. Generate comprehensive user stories, epics, and development stories based on the following business canvas.

## Business Canvas

**Title:** ${title}

**Problem Statement:** ${problemStatement}

**Solution Recommendation:** ${solutionRecommendation}

**Key Features:** ${keyFeatures}

**Objectives:** ${objectives}`;

  // Add OKRs section if available
  if (hasOkrs && okrObjectives.length > 0) {
    prompt += `

**OKRs (Objectives and Key Results):**
${okrObjectives.map((okr) => {
  const okrObj = okr as { id?: string; title?: string; description?: string };
  const keyResults = okrsArray.filter((kr): kr is Record<string, unknown> => {
    return typeof kr === 'object' && kr !== null && 'type' in kr && kr.type === "key-result" && 'parentId' in kr && kr.parentId === okrObj.id;
  });
  return `
- **${okrObj.title || 'Untitled'}**: ${okrObj.description || 'No description'}
  Key Results:
${keyResults.map((kr) => {
  const krObj = kr as { title?: string; targetValue?: string };
  return `  - ${krObj.title || 'Untitled'}${krObj.targetValue ? ` (Target: ${krObj.targetValue})` : ''}`;
}).join('\n')}`;
}).join('\n')}

**IMPORTANT**: Generate Epics that directly map to the OKRs above. Each Epic should align with one or more Objectives.`;
  }

  prompt += `

## Task

Generate a focused set of stories organized as:
1. **Epics**: High-level features or themes (2-3 epics maximum)
2. **User Stories**: Specific user-facing functionality (3-5 stories per epic)
3. **Development Stories**: Technical tasks and infrastructure work (2-3 per epic)

Keep the total number of stories under 25 to ensure complete, valid JSON output.

## Output Format

Return ONLY valid JSON matching this structure:

[
  {
    "id": "EPIC-1",
    "type": "epic",
    "title": "Epic Title",
    "description": "Detailed description of the epic covering the business value and scope",
    "priority": "high"
  },
  {
    "id": "US-1",
    "type": "user-story",
    "title": "As a [user type], I want to [action] so that [benefit]",
    "description": "Detailed description",
    "acceptanceCriteria": [
      "Criterion 1",
      "Criterion 2",
      "Criterion 3"
    ],
    "priority": "high",
    "storyPoints": 5,
    "epic": "EPIC-1"
  },
  {
    "id": "DEV-1",
    "type": "dev-story",
    "title": "Technical Task Title",
    "description": "Technical implementation details",
    "acceptanceCriteria": [
      "Technical requirement 1",
      "Technical requirement 2"
    ],
    "priority": "medium",
    "storyPoints": 3,
    "epic": "EPIC-1"
  }
]

## Guidelines

1. **Epics**: Should represent major features or capabilities from the key features list
2. **User Stories**: Follow the "As a [role], I want [feature] so that [benefit]" format
3. **Acceptance Criteria**: Be specific and testable (3-5 criteria per story)
4. **Story Points**: Use fibonacci sequence (1, 2, 3, 5, 8, 13)
5. **Priority**: Use "high", "medium", or "low" based on business value
6. **Development Stories**: Include technical work like API development, database setup, infrastructure, testing

CRITICAL: Return ONLY the JSON array. No markdown code fences, no explanatory text, just the JSON.`;

  return prompt;
}

/**
 * Builds the prompt for generating execution plan from canvas and stories
 */
export function buildExecutionPrompt(
  canvas: import("@/lib/validators/canvas-schema").BusinessCanvas,
  stories: import("@/stores/canvas-store").Story[]
): string {
  const epics = stories.filter(s => s.type === "epic");
  const userStories = stories.filter(s => s.type === "user-story");
  const devStories = stories.filter(s => s.type === "dev-story");

  return `You are a senior project manager and agile coach. Generate a comprehensive execution plan including sprint schedules and resource allocation based on the following business canvas and stories.

## Business Canvas

**Title:** ${canvas.title.value}

**Problem Statement:** ${canvas.problemStatement.value || "Not specified"}

**Solution Recommendation:** ${canvas.solutionRecommendation?.value || "Not specified"}

**Objectives:** ${Array.isArray(canvas.objectives?.value) ? canvas.objectives.value.join(", ") : "Not specified"}

**Timeline:** ${canvas.timelines?.value ? JSON.stringify(canvas.timelines.value) : "Not specified"}

${canvas.budgetResources?.value ? `**Budget:** ${JSON.stringify(canvas.budgetResources.value)}` : ""}

## Stories Summary

- **Epics:** ${epics.length} total
- **User Stories:** ${userStories.length} total
- **Dev Stories:** ${devStories.length} total
- **Total Story Points:** ${[...userStories, ...devStories].reduce((sum, s) => sum + (s.storyPoints || 0), 0)}

## Task

Generate a comprehensive execution plan with:

1. **Sprint Plan**: Break stories into 2-week sprints with realistic capacity
2. **Resource Allocation**: Identify and allocate people, budget, tools, and infrastructure

**Note:** OKRs have already been defined in the business canvas and should not be regenerated here. The execution plan focuses on sprint scheduling and resource planning.

## Output Format

Return ONLY valid JSON matching this structure:

{
  "sprints": [
    {
      "id": "sprint-1",
      "name": "Sprint 1: Foundation",
      "goal": "Set up core infrastructure and authentication",
      "startDate": "2025-01-06",
      "endDate": "2025-01-17",
      "stories": ["US-1", "US-2", "DEV-1"],
      "capacity": 30,
      "velocity": 28
    }
  ],
  "resources": [
    {
      "id": "res-1",
      "type": "people",
      "name": "Frontend Engineers",
      "description": "2 senior React developers",
      "allocation": "Full-time for 3 months",
      "cost": "$180,000",
      "timeline": "Q1 2025"
    },
    {
      "id": "res-2",
      "type": "budget",
      "name": "Infrastructure Costs",
      "description": "AWS hosting and services",
      "allocation": "Ongoing operational expense",
      "cost": "$2,000/month",
      "timeline": "Ongoing"
    },
    {
      "id": "res-3",
      "type": "tools",
      "name": "Development Tools",
      "description": "Licenses for Figma, GitHub, Vercel",
      "allocation": "Team licenses",
      "cost": "$500/month",
      "timeline": "Ongoing"
    }
  ]
}

## Guidelines

1. **Sprints**:
   - 2-week iterations
   - Velocity = 70-80% of capacity (account for meetings, reviews)
   - Balance user stories and dev stories
   - Early sprints focus on infrastructure, later on features

2. **Resources**:
   - People: roles, seniority, allocation percentage
   - Budget: categories from canvas budget breakdown
   - Tools: development, design, collaboration tools
   - Infrastructure: hosting, databases, services

3. **Story Allocation**:
   - Distribute story IDs across sprints logically
   - Dependencies first (infrastructure, auth)
   - Highest priority stories earlier
   - Balance load across sprints

CRITICAL: Return ONLY the JSON object. No markdown code fences, no explanatory text, just the JSON.`;
}

/**
 * Builds the prompt for detecting conflicts in a canvas
 */
export function buildConflictDetectionPrompt(
  canvas: import("@/lib/validators/canvas-schema").BusinessCanvas
): string {
  return `You are an expert business analyst reviewing a business canvas for internal contradictions, inconsistencies, and potential issues.

## Business Canvas to Analyze

**Title:** ${canvas.title.value}

**Problem Statement:** ${canvas.problemStatement.value || "Not specified"}

**Solution Recommendation:** ${canvas.solutionRecommendation?.value || "Not specified"}

**Objectives:** ${Array.isArray(canvas.objectives?.value) ? canvas.objectives.value.join(", ") : "Not specified"}

**KPIs:** ${Array.isArray(canvas.kpis?.value) ? canvas.kpis.value.join(", ") : "Not specified"}

**Timeline:** ${canvas.timelines?.value ? JSON.stringify(canvas.timelines.value) : "Not specified"}

**Budget:** ${canvas.budgetResources?.value ? JSON.stringify(canvas.budgetResources.value) : "Not specified"}

**Key Features:** ${Array.isArray(canvas.keyFeatures?.value) ? canvas.keyFeatures.value.join(", ") : "Not specified"}

**Risks:** ${Array.isArray(canvas.risks?.value) ? canvas.risks.value.join(", ") : "Not specified"}

**Dependencies:** ${Array.isArray(canvas.dependencies?.value) ? canvas.dependencies.value.join(", ") : "Not specified"}

## Task

Analyze the above canvas for contradictions and conflicts. Look for:

1. **Budget Conflicts**: Budget too low for the scope of work or features requested
2. **Timeline Conflicts**: Timeline too aggressive for the complexity or number of features
3. **Scope Conflicts**: Objectives or features that contradict each other or are misaligned
4. **Resource Conflicts**: Dependencies or resources that don't align with the budget or timeline
5. **Risk Conflicts**: Identified risks that contradict the optimism in timelines or objectives

## Output Format

Return ONLY valid JSON matching this structure:

[
  {
    "id": "conflict-1",
    "conflictType": "budget",
    "fieldKeys": ["budgetResources", "keyFeatures"],
    "description": "The proposed budget of $50K appears insufficient for implementing 15+ complex features including AI-powered recommendations and real-time analytics. Industry benchmarks suggest $150-200K for this scope.",
    "severity": "high"
  },
  {
    "id": "conflict-2",
    "conflictType": "timeline",
    "fieldKeys": ["timelines", "keyFeatures", "dependencies"],
    "description": "The 3-month timeline conflicts with the need to integrate 5 external systems and build 10 major features. Similar projects typically require 6-9 months.",
    "severity": "medium"
  }
]

## Guidelines

1. **Severity Levels**:
   - high: Critical conflicts that will likely cause project failure
   - medium: Significant conflicts that need attention but are manageable
   - low: Minor inconsistencies that should be noted

2. **Field Keys**: Use exact canvas field names (e.g., "budgetResources", "timelines", "keyFeatures", "objectives", "risks")

3. **Descriptions**: Be specific with numbers, percentages, and concrete examples

4. **Conflict Types**: Use one of: "budget", "timeline", "scope", "resource", "risk", "other"

5. **Be Constructive**: Focus on genuine conflicts, not nitpicking. Only report conflicts that could impact project success.

6. **Empty Array**: If no significant conflicts are found, return an empty array []

CRITICAL: Return ONLY the JSON array. No markdown code fences, no explanatory text, just the JSON.`;
}

/**
 * Builds the prompt for generating industry benchmarks
 */
export function buildBenchmarksPrompt(
  canvas: import("@/lib/validators/canvas-schema").BusinessCanvas,
  industry: string
): string {
  return `You are a senior business analyst with deep industry expertise. Generate industry benchmarks to compare this business canvas against industry standards.

## Business Canvas

**Title:** ${canvas.title.value}

**Industry:** ${industry}

**Problem Statement:** ${canvas.problemStatement.value || "Not specified"}

**Objectives:** ${Array.isArray(canvas.objectives?.value) ? canvas.objectives.value.join(", ") : "Not specified"}

**KPIs:** ${Array.isArray(canvas.kpis?.value) ? canvas.kpis.value.join(", ") : "Not specified"}

**Timeline:** ${canvas.timelines?.value ? JSON.stringify(canvas.timelines.value) : "Not specified"}

${canvas.budgetResources?.value ? `**Budget:** ${JSON.stringify(canvas.budgetResources.value)}` : ""}

## Task

Using your knowledge of the ${industry} industry, generate benchmarks comparing this canvas against industry averages and top performers.

Focus on these types of metrics:
- **Timeline**: Project duration vs industry norms
- **Budget**: Cost estimates vs typical project budgets
- **Team Size**: FTE requirements vs industry standards
- **Success Metrics**: KPI targets vs industry benchmarks
- **ROI**: Expected returns vs industry averages

## Output Format

Return ONLY valid JSON matching this structure:

[
  {
    "metric": "Project Timeline",
    "yourValue": "6 months",
    "industryAverage": "8-10 months",
    "topPerformers": "4-6 months",
    "assessment": "above",
    "recommendation": "Your timeline is aggressive but achievable with proper planning. Consider adding 1-2 months buffer for unforeseen challenges."
  },
  {
    "metric": "Budget per Feature",
    "yourValue": "$15,000 per feature",
    "industryAverage": "$20,000-$25,000 per feature",
    "topPerformers": "$12,000-$18,000 per feature",
    "assessment": "at",
    "recommendation": "Budget is competitive. Focus on efficient development practices to maintain this advantage."
  }
]

## Guidelines

1. **Relevant Metrics**: Generate 4-6 benchmarks most relevant to this specific canvas
2. **Industry Context**: Base comparisons on actual ${industry} industry data
3. **Assessment Types**:
   - "above": Better than industry average (faster, cheaper, higher targets)
   - "at": At or near industry average
   - "below": Below industry average (slower, more expensive, lower targets)
4. **Recommendations**: Provide actionable advice (1-2 sentences)
5. **Realistic Data**: Use your knowledge of ${industry} to provide accurate benchmarks
6. **Value Format**: Use clear units (months, $, %, FTE, etc.)

CRITICAL: Return ONLY the JSON array. No markdown code fences, no explanatory text, just the JSON.`;
}

/**
 * Builds the prompt for generating Epics from selected OKRs
 * Yale workflow: OKRs → Epics
 */
export function buildEpicsFromOKRsPrompt(
  canvas: import("@/lib/validators/canvas-schema").BusinessCanvas,
  selectedOKRIds: string[]
): string {
  // Handle case where okrs.value may be string instead of array
  const okrsValue = canvas.okrs?.value;
  const okrs = Array.isArray(okrsValue) ? okrsValue : [];
  const selectedOKRs = okrs.filter((okr): okr is Record<string, unknown> => {
    return typeof okr === 'object' && okr !== null && 'id' in okr && typeof okr.id === 'string' && selectedOKRIds.includes(okr.id);
  });

  const selectedObjectives = selectedOKRs.filter((okr) => {
    return 'type' in okr && okr.type === "objective";
  });

  return `You are a senior product strategist and agile expert. Generate high-level Epics based on selected OKRs from a business canvas.

## Business Canvas Context

**Title:** ${canvas.title?.value || "Untitled Canvas"}

**Problem Statement:** ${canvas.problemStatement?.value || "No problem statement provided"}

**Solution Recommendation:** ${canvas.solutionRecommendation?.value || "No solution provided"}

## Selected OKRs

The following OKRs have been selected for Epic generation:

${selectedObjectives.map((okr) => {
  const okrObj = okr as { id?: string; title?: string; description?: string };
  const keyResults = selectedOKRs.filter((kr) => {
    const krObj = kr as { type?: string; parentId?: string };
    return krObj.type === "key-result" && krObj.parentId === okrObj.id;
  });
  return `
### ${okrObj.title || 'Untitled'}
**OKR ID: ${okrObj.id || 'unknown'}** (use this exact ID for the parentOKR field)
${okrObj.description || 'No description'}

**Key Results:**
${keyResults.map((kr) => {
  const krObj = kr as { title?: string; targetValue?: string };
  return `- ${krObj.title || 'Untitled'}${krObj.targetValue ? ` (Target: ${krObj.targetValue})` : ''}`;
}).join('\n')}
`;
}).join('\n')}

## Task

Generate 2-4 high-level Epics that directly map to these OKRs. Each Epic should:
- Align with one or more of the selected Objectives
- Reference the parent OKR in the parentOKR field
- Include the original requirement context for audit purposes
- Represent a major body of work (multiple features/stories)
- Focus on business value and strategic goals

## Output Format

Return ONLY valid JSON matching this structure:

[
  {
    "id": "EPIC-1",
    "type": "epic",
    "title": "Epic Title That Aligns with OKR",
    "description": "Comprehensive description explaining how this epic achieves the OKR objective. Should be 2-3 sentences covering scope and business value.",
    "priority": "high",
    "parentOKR": "okr-1",
    "originRequirement": "Brief excerpt from the problem statement that justifies this epic"
  }
]

## Guidelines

1. **OKR Alignment**: Each epic MUST reference a parentOKR from the selected OKRs above
2. **Origin Requirement**: Extract relevant text from the problem statement showing where this need originated
3. **Priority**: Base priority on the OKR's importance and business impact (high/medium/low)
4. **Traceability**: The parentOKR and originRequirement fields enable audit trails
5. **Focus**: Keep to 2-4 epics maximum - these are large strategic themes
6. **Business Language**: Write for stakeholders, not just developers

CRITICAL: Return ONLY the JSON array. No markdown code fences, no explanatory text, just the JSON.`;
}

/**
 * Build prompt for generating epics from a business requirement (alternative to OKRs)
 */
export function buildEpicsFromBusinessRequirementPrompt(
  canvas: import("@/lib/validators/canvas-schema").BusinessCanvas,
  businessRequirement: { id: string; title: string; description: string; category: string }
): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = canvas as any;

  return `You are a senior product strategist and agile expert. Generate high-level Epics based on a business requirement derived from canvas analysis.

## Business Canvas Context

**Title:** ${c.title?.value || "Untitled Canvas"}

**Problem Statement:** ${c.problemStatement?.value || c.problem?.value || "No problem statement provided"}

**Solution Recommendation:** ${c.solutionRecommendation?.value || c.solution?.value || "No solution provided"}

${c.valueProposition?.value ? `**Value Proposition:** ${c.valueProposition.value}` : ''}

${c.targetAudience?.value ? `**Target Audience:** ${c.targetAudience.value}` : ''}

## Business Requirement

**Category:** ${businessRequirement.category}
**Title:** ${businessRequirement.title}
**Description:** ${businessRequirement.description}
**Requirement ID:** ${businessRequirement.id} (use this exact ID for the parentOKR field to track lineage)

## Task

Generate 2-4 high-level Epics that address this business requirement. Each Epic should:
- Directly contribute to fulfilling the business requirement
- Reference the requirement ID in the parentOKR field (for audit/lineage tracking)
- Represent a major body of work (multiple features/stories)
- Focus on business value and strategic goals
- Be implementable and measurable

## Output Format

Return ONLY valid JSON matching this structure:

[
  {
    "id": "epic-unique-id-1",
    "type": "epic",
    "title": "Epic Title (concise, 5-10 words)",
    "description": "Detailed description of what this epic delivers and why it matters",
    "priority": "high" | "medium" | "low",
    "parentOKR": "${businessRequirement.id}",
    "acceptanceCriteria": ["Criterion 1", "Criterion 2", "Criterion 3"]
  }
]

Generate epics that are:
- **Strategic**: Focus on high-level business outcomes
- **Measurable**: Include clear acceptance criteria
- **Aligned**: Directly support the business requirement
- **Scoped**: Represent 1-3 months of work each`;
}

/**
 * Builds the prompt for generating Features from selected Epics
 * Yale workflow: Epics → Features
 */
export function buildFeaturesFromEpicsPrompt(
  canvas: import("@/lib/validators/canvas-schema").BusinessCanvas,
  epics: import("@/stores/canvas-store").Story[],
  selectedEpicIds: string[]
): string {
  const selectedEpics = epics.filter(epic => selectedEpicIds.includes(epic.id));

  return `You are a senior product manager and feature architect. Generate mid-level Features based on selected Epics.

## Business Canvas Context

**Title:** ${canvas.title?.value || "Untitled Canvas"}

**Problem Statement:** ${canvas.problemStatement?.value || "No problem statement provided"}

**Key Features from Canvas:** ${Array.isArray(canvas.keyFeatures?.value) ? canvas.keyFeatures.value.join(", ") : "No features specified"}

## Selected Epics

The following Epics have been selected for Feature generation:

${selectedEpics.map(epic => `
### ${epic.title} (${epic.id})
${epic.description}
- **Priority:** ${epic.priority || "medium"}
- **Parent OKR:** ${epic.parentOKR || "N/A"}
- **Origin:** ${epic.originRequirement || "N/A"}
`).join('\n')}

## Task

Generate 3-6 Features per Epic that break down the Epic into concrete, deliverable capabilities. Each Feature should:
- Belong to one of the selected Epics (epic field)
- Reference the parent OKR for traceability (parentOKR field)
- Include origin requirement context for audit
- Represent a distinct capability or component
- Be small enough to deliver in 2-4 sprints

## Output Format

Return ONLY valid JSON matching this structure:

[
  {
    "id": "FEAT-1",
    "type": "feature",
    "title": "Feature Title",
    "description": "Detailed description of what this feature delivers. Should explain the capability, user benefit, and how it contributes to the parent epic. 2-3 sentences.",
    "priority": "high",
    "storyPoints": 13,
    "epic": "EPIC-1",
    "parentOKR": "okr-1",
    "originRequirement": "Text from problem statement showing why this feature is needed"
  }
]

## Guidelines

1. **Epic Mapping**: Each feature MUST reference its parent epic in the "epic" field
2. **OKR Traceability**: Inherit parentOKR from the parent epic for audit trail
3. **Origin Requirement**: Extract relevant problem statement text justifying this feature
4. **Story Points**: Estimate total effort (fibonacci: 8, 13, 21, 34)
5. **Priority**: Inherit from epic or adjust based on dependencies (high/medium/low)
6. **Scope**: Each feature should be deliverable in 2-4 sprints when broken into stories
7. **Coverage**: Ensure features comprehensively cover the epic's scope

CRITICAL: Return ONLY the JSON array. No markdown code fences, no explanatory text, just the JSON.`;
}

/**
 * Builds the prompt for generating User Stories and Dev Stories from selected Features
 * Yale workflow: Features → User Stories + Dev Stories
 */
export function buildUserStoriesFromFeaturesPrompt(
  canvas: import("@/lib/validators/canvas-schema").BusinessCanvas,
  features: import("@/stores/canvas-store").Story[],
  selectedFeatureIds: string[]
): string {
  const selectedFeatures = features.filter(feature => selectedFeatureIds.includes(feature.id));

  return `You are a senior product manager and agile expert. Generate detailed User Stories and Development Stories based on selected Features.

## Business Canvas Context

**Title:** ${canvas.title?.value || "Untitled Canvas"}

**Problem Statement:** ${canvas.problemStatement?.value || "No problem statement provided"}

**Solution Recommendation:** ${canvas.solutionRecommendation?.value || "No solution provided"}

## Selected Features

The following Features have been selected for Story generation:

${selectedFeatures.map(feature => `
### ${feature.title} (${feature.id})
${feature.description}
- **Priority:** ${feature.priority || "medium"}
- **Story Points:** ${feature.storyPoints || "N/A"}
- **Epic:** ${feature.epic || "N/A"}
- **Parent OKR:** ${feature.parentOKR || "N/A"}
`).join('\n')}

## Task

For each selected feature, generate:
1. **User Stories** (3-5 per feature): User-facing functionality following "As a [role], I want [action] so that [benefit]" format
2. **Dev Stories** (2-3 per feature): Technical tasks including infrastructure, APIs, testing, and technical debt

Each story should:
- Reference its parent feature (feature field)
- Reference the parent epic (epic field)
- Inherit OKR lineage for traceability (parentOKR field)
- Include origin requirement for audit purposes

## Output Format

Return ONLY valid JSON matching this structure:

[
  {
    "id": "US-1",
    "type": "user-story",
    "title": "As a [user type], I want to [action] so that [benefit]",
    "description": "Detailed explanation of the user story including context, user needs, and expected behavior. 2-3 sentences.",
    "acceptanceCriteria": [
      "Specific, testable criterion 1",
      "Specific, testable criterion 2",
      "Specific, testable criterion 3"
    ],
    "priority": "high",
    "storyPoints": 5,
    "epic": "EPIC-1",
    "feature": "FEAT-1",
    "parentOKR": "okr-1",
    "originRequirement": "Relevant text from problem statement"
  },
  {
    "id": "DEV-1",
    "type": "dev-story",
    "title": "Technical Task Title",
    "description": "Technical implementation details, architectural considerations, and technical requirements. 2-3 sentences.",
    "acceptanceCriteria": [
      "Technical requirement 1",
      "Technical requirement 2",
      "Technical requirement 3"
    ],
    "priority": "high",
    "storyPoints": 3,
    "epic": "EPIC-1",
    "feature": "FEAT-1",
    "parentOKR": "okr-1",
    "originRequirement": "Technical need from problem context"
  }
]

## Guidelines

1. **Feature Mapping**: Each story MUST reference its parent feature in the "feature" field
2. **Epic Mapping**: Each story MUST reference its parent epic in the "epic" field
3. **OKR Traceability**: Inherit parentOKR from parent feature for complete audit trail
4. **Origin Requirement**: Extract relevant problem statement text showing need for this story
5. **User Stories**: Follow standard format, focus on user value and behavior
6. **Dev Stories**: Cover technical work (APIs, database, infrastructure, testing, refactoring)
7. **Acceptance Criteria**: 3-5 specific, testable criteria per story
8. **Story Points**: Use fibonacci (1, 2, 3, 5, 8, 13) - stories should be completable in 1 sprint
9. **Priority**: Inherit from feature or adjust based on dependencies
10. **Completeness**: Ensure stories fully implement the parent feature

Keep total stories under 30 to ensure complete, valid JSON output.

CRITICAL: Return ONLY the JSON array. No markdown code fences, no explanatory text, just the JSON.`;
}
