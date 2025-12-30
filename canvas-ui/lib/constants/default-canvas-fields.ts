export type DisplayStyle = "auto" | "bullets";
 
export type DefaultCanvasFieldConfig = {
  id: string;
  name: string;
  fieldKey: string;
  type: "default";
  category: "core" | "planning" | "technical" | "financial" | "risk_stakeholders" | "custom";
  enabled: boolean;
  includeInGeneration: boolean;
  order: number;
  valueType: "string" | "array" | "object";
  instructions: string;
  examples?: string;
  negativePrompt?: string;
  isRequired?: boolean;
  supportsDiagram?: boolean;
  displayStyle?: DisplayStyle;
  description?: string;
};
 
/**
* Default canvas field configurations (hardcoded).
*
* Removed (per requirements):
* - `urgency`
* - `timelines`
* - `alignmentLongTerm` (strategic alignment)
*/
export const DEFAULT_CANVAS_FIELDS: DefaultCanvasFieldConfig[] = [
  // === CORE FIELDS (Always Required) ===
  {
    id: "title",
    name: "Title",
    fieldKey: "title",
    type: "default",
    category: "core",
    enabled: true,
    includeInGeneration: true,
    order: 0,
    valueType: "string",
    instructions: "Generate a clear, concise title that captures the essence of the business problem or initiative",
    isRequired: true,
    supportsDiagram: false,
    displayStyle: "auto",
    description: "The canvas title - cannot be disabled",
  },
  {
    id: "problemStatement",
    name: "Problem Statement",
    fieldKey: "problemStatement",
    type: "default",
    category: "core",
    enabled: true,
    includeInGeneration: true,
    order: 1,
    valueType: "string",
    instructions: "Extract metrics and business impact from documents; include exact numbers mentioned",
    examples: '"Customer churn rate increased from 5% to 12% over 6 months, resulting in $2M revenue loss"',
    isRequired: true,
    supportsDiagram: false,
    displayStyle: "auto",
    description: "The core business problem - cannot be disabled",
  },
  {
    id: "solutionRecommendation",
    name: "Solution Recommendation",
    fieldKey: "solutionRecommendation",
    type: "default",
    category: "core",
    enabled: true,
    includeInGeneration: true,
    order: 2,
    valueType: "object",
    instructions:
      "MUST return an object with 'value' (string description), 'actions' (array of {action, priority}), 'evidence', and 'confidence'. Base recommendations on capabilities and approaches mentioned in documents; add strategic depth with specific actions prioritized by impact",
    isRequired: false,
    supportsDiagram: true,
    displayStyle: "auto",
    description: "Recommended solution with prioritized actions",
  },
 
  // === PLANNING FIELDS ===
  {
    id: "objectives",
    name: "Objectives",
    fieldKey: "objectives",
    type: "default",
    category: "planning",
    enabled: true,
    includeInGeneration: true,
    order: 3,
    valueType: "array",
    instructions: "Extract stated goals and targets EXACTLY as specified in documents; cite document evidence",
    examples: '["Reduce customer acquisition cost by 30%", "Improve user retention to 85%", "Launch MVP in Q2 2025"]',
    negativePrompt: "Do NOT fabricate specific percentage targets without document evidence",
    supportsDiagram: false,
    displayStyle: "bullets",
    isRequired: false,
    description: "Business objectives and goals",
  },
  {
    id: "okrs",
    name: "OKRs",
    fieldKey: "okrs",
    type: "default",
    category: "planning",
    enabled: false,
    includeInGeneration: false,
    order: 4,
    valueType: "array",
    instructions:
      'CRITICAL: Output MUST be an array of objects with EXACT structure. Each object MUST have: "id" (unique string like "okr-1"), "type" ("objective" or "key-result"), "title" (string), "description" (string). Key results MUST have "parentId" matching their parent objective\'s id, plus "targetValue" and "currentValue". Create 2-3 objectives, each with 2-4 key results.',
    examples:
      '[{"id": "okr-1", "type": "objective", "title": "Revolutionize Product Discovery", "description": "Eliminate static friction of online shopping", "dueDate": "2025-09-30", "owner": "Product Team"}, {"id": "kr-1", "type": "key-result", "title": "100% Hero products feature motion video", "description": "All Leather, Suede, Cashmere products have HD video", "targetValue": "100%", "currentValue": "0%", "parentId": "okr-1", "dueDate": "2025-09-30"}]',
    negativePrompt:
      "NEVER output simple strings like 'Objective: ...' - MUST be structured objects with id, type, title, description fields",
    isRequired: false,
    supportsDiagram: false,
    displayStyle: "auto",
    description: "Objectives and Key Results framework",
  },
  {
    id: "kpis",
    name: "KPIs",
    fieldKey: "kpis",
    type: "default",
    category: "planning",
    enabled: true,
    includeInGeneration: true,
    order: 5,
    valueType: "array",
    instructions: "Look for numerical targets (e.g., 'conversion: 2.1% → 4.5%'); extract ALL metrics mentioned across documents",
    examples:
      '["Monthly Active Users: 50K → 100K", "Conversion Rate: 2.1% → 4.5%", "Customer Satisfaction Score: 3.8 → 4.5"]',
    negativePrompt: "Do NOT use industry averages - only document-based specific targets",
    isRequired: false,
    supportsDiagram: false,
    displayStyle: "bullets",
    description: "Key Performance Indicators with current and target values",
  },
  {
    id: "successCriteria",
    name: "Success Criteria",
    fieldKey: "successCriteria",
    type: "default",
    category: "planning",
    enabled: false,
    includeInGeneration: false,
    order: 6,
    valueType: "array",
    instructions: `Define specific, measurable success criteria. Each criterion MUST have THREE distinct fields:
- "metric": A SHORT name/label for what is being measured (e.g., "User Adoption Rate", "Conversion Rate", "Customer Satisfaction")
- "target": The specific quantitative goal or threshold (e.g., "70% within 3 months", "15% increase", "4.5/5.0 rating")
- "measurement": How the metric will be calculated or tracked (e.g., "Monthly active users / total signups")
IMPORTANT: The "metric" should be a brief label (2-5 words), NOT the full success statement. The "target" should be the measurable goal, NOT a repeat of the metric.`,
    examples:
      '[{"metric": "User Adoption Rate", "target": "70% within 3 months", "measurement": "Monthly active users / total signups"}, {"metric": "PDP Conversion Rate", "target": "15% sustained for 3 months", "measurement": "Purchases / product page views"}, {"metric": "Customer Satisfaction", "target": "4.5/5.0 rating", "measurement": "Post-purchase survey scores"}]',
    negativePrompt:
      "Do NOT put the full success statement in the metric field. Do NOT duplicate the metric text in the target field. The metric should be a SHORT label, the target should be a SPECIFIC measurable value.",
    isRequired: false,
    supportsDiagram: false,
    displayStyle: "auto",
    description: "Measurable success criteria",
  },
 
  // === TECHNICAL FIELDS ===
  {
    id: "keyFeatures",
    name: "Key Features",
    fieldKey: "keyFeatures",
    type: "default",
    category: "technical",
    enabled: true,
    includeInGeneration: true,
    order: 9,
    valueType: "array",
    instructions: "Extract specific capabilities, technologies, and features mentioned; note vendor names if specified",
    examples: '["Real-time inventory sync", "AI-powered recommendations", "Multi-channel integration"]',
    supportsDiagram: false,
    displayStyle: "bullets",
    isRequired: false,
    description: "Core features and capabilities",
  },
  {
    id: "dependencies",
    name: "Dependencies",
    fieldKey: "dependencies",
    type: "default",
    category: "technical",
    enabled: true,
    includeInGeneration: true,
    order: 10,
    valueType: "array",
    instructions:
      "Extract named systems, platforms, and vendors from documents (e.g., 'Salesforce Customer 360', 'Google Cloud Platform')",
    examples: '["Salesforce CRM integration", "Payment gateway (Stripe)", "AWS infrastructure"]',
    negativePrompt: "Do NOT fabricate technology stacks without evidence",
    isRequired: false,
    supportsDiagram: true,
    displayStyle: "bullets",
    description: "External systems and platform dependencies",
  },
  {
    id: "dataDependencies",
    name: "Data Dependencies",
    fieldKey: "dataDependencies",
    type: "default",
    category: "technical",
    enabled: true,
    includeInGeneration: true,
    order: 11,
    valueType: "array",
    instructions: "Extract specific data sources, APIs, and integration points mentioned",
    examples: '["Customer database (PostgreSQL)", "Product catalog API", "Analytics data warehouse"]',
    isRequired: false,
    supportsDiagram: false,
    displayStyle: "bullets",
    description: "Data sources and integrations required",
  },
  {
    id: "technicalArchitecture",
    name: "Technical Architecture",
    fieldKey: "technicalArchitecture",
    type: "default",
    category: "technical",
    enabled: false,
    includeInGeneration: false,
    order: 12,
    valueType: "array",
    instructions: "Extract mentioned technologies, platforms, and architectural patterns",
    examples:
      '[{"layer": "Frontend", "components": ["React", "Next.js"], "description": "Server-side rendered SPA"}]',
    isRequired: false,
    supportsDiagram: true,
    displayStyle: "auto",
    description: "System architecture and technology stack",
  },
  {
    id: "securityCompliance",
    name: "Security & Compliance",
    fieldKey: "securityCompliance",
    type: "default",
    category: "technical",
    enabled: false,
    includeInGeneration: false,
    order: 13,
    valueType: "array",
    instructions: "Extract security requirements, compliance standards, and data privacy needs",
    examples: '["GDPR compliance", "SOC 2 Type II certification", "End-to-end encryption"]',
    isRequired: false,
    supportsDiagram: false,
    displayStyle: "bullets",
    description: "Security and compliance requirements",
  },
 
  // === FINANCIAL FIELDS ===
  {
    id: "budgetResources",
    name: "Budget & Resources",
    fieldKey: "budgetResources",
    type: "default",
    category: "financial",
    enabled: false,
    includeInGeneration: false,
    order: 14,
    valueType: "object",
    instructions: "Extract EXACT budget numbers, investment allocations, and cost breakdowns; NEVER estimate when data exists",
    examples:
      '{"totalEstimate": "$500K", "breakdown": [{"category": "Development", "amount": "$300K"}], "fteRequirements": "5 engineers, 2 designers"}',
    negativePrompt: "Do NOT estimate budgets without explicit document data",
    supportsDiagram: false,
    displayStyle: "auto",
    isRequired: false,
    description: "Budget breakdown and resource requirements",
  },
  {
    id: "roiAnalysis",
    name: "ROI Analysis",
    fieldKey: "roiAnalysis",
    type: "default",
    category: "financial",
    enabled: false,
    includeInGeneration: false,
    order: 15,
    valueType: "object",
    instructions: "Calculate return on investment, payback period, and financial justification based on stated benefits and costs",
    examples: '{"expectedReturn": "$2M annual savings", "paybackPeriod": "18 months", "costBenefit": "3:1 ratio"}',
    isRequired: false,
    supportsDiagram: false,
    displayStyle: "auto",
    description: "Return on investment metrics",
  },
 
  // === RISK & STAKEHOLDERS ===
  {
    id: "risks",
    name: "Risks",
    fieldKey: "risks",
    type: "default",
    category: "risk_stakeholders",
    enabled: true,
    includeInGeneration: true,
    order: 16,
    valueType: "array",
    instructions: "Prioritize real issues documented in customer feedback or project documents over generic risks",
    examples:
      '["Technical: Legacy system migration complexity", "Business: Market competition from X", "Timeline: Dependency on external vendor"]',
    supportsDiagram: false,
    displayStyle: "bullets",
    isRequired: false,
    description: "Project risks and mitigation strategies",
  },
  {
    id: "stakeholderMap",
    name: "Stakeholder Map",
    fieldKey: "stakeholderMap",
    type: "default",
    category: "risk_stakeholders",
    enabled: false,
    includeInGeneration: false,
    order: 17,
    valueType: "array",
    instructions: "Extract named stakeholders, roles, and organizational structure from documents",
    examples:
      '[{"name": "Sarah Chen", "role": "Product Owner", "influence": "high", "interest": "high", "raciRole": "accountable"}]',
    negativePrompt: "Do NOT fabricate stakeholder names without document evidence",
    isRequired: false,
    supportsDiagram: true,
    displayStyle: "auto",
    description: "Key stakeholders with influence and interest levels",
  },
  {
    id: "changeManagement",
    name: "Change Management",
    fieldKey: "changeManagement",
    type: "default",
    category: "risk_stakeholders",
    enabled: false,
    includeInGeneration: false,
    order: 18,
    valueType: "object",
    instructions: "Identify training needs, communication plans, adoption strategies, and resistance mitigation",
    examples:
      '{"trainingNeeds": ["End-user training", "Admin workshops"], "communicationPlan": "Weekly updates to leadership", "adoptionStrategy": "Phased rollout by department"}',
    isRequired: false,
    supportsDiagram: false,
    displayStyle: "auto",
    description: "Change management and adoption plan",
  },
  {
    id: "assumptions",
    name: "Assumptions",
    fieldKey: "assumptions",
    type: "default",
    category: "risk_stakeholders",
    enabled: false,
    includeInGeneration: false,
    order: 19,
    valueType: "array",
    instructions: "List key assumptions that the canvas and recommendations are based on",
    examples: '["Users have reliable internet access", "Current infrastructure can handle 2x traffic", "Team has React expertise"]',
    isRequired: false,
    supportsDiagram: false,
    displayStyle: "bullets",
    description: "Project assumptions to validate",
  },
 
  // === PERSONAS ===
  {
    id: "personas",
    name: "Personas",
    fieldKey: "personas",
    type: "default",
    category: "planning",
    enabled: true,
    includeInGeneration: true,
    order: 21,
    valueType: "array",
    instructions:
      'Extract user personas from documents. Each persona MUST be an object with these EXACT keys: "name" (e.g. "Persona 1: Style-Conscious Professional (Primary Target)"), "profile", "needs", "painPoints", "successDefinition". The rendered output will display each persona as a heading followed by bullet points with bold labels like "• **Profile:** ...", "• **Needs:** ...", "• **Pain Points:** ...", "• **Success Definition:** ...". Create multiple distinct personas if document evidence supports them.',
    examples:
      '[{"name": "Persona 1: Style-Conscious Professional (Primary Target)", "profile": "28-35 year old professional who discovered Banana Republic through the \'Heritage Made Relevant\' campaign. Values quality and fit but shops primarily on mobile during commute or lunch breaks. Seeks sophisticated, workplace-appropriate clothing with modern styling.", "needs": "Quick assessment of fit and styling, confidence in online purchases, seamless mobile experience, and assurance that items will look professional in person.", "painPoints": "Cannot judge fabric drape or fit from static photos, frustrated by high return rates, limited time for in-store shopping, and disconnect between inspiring campaign content and boring product pages.", "successDefinition": "Completes purchase within 3 minutes of product page visit, achieves 90% satisfaction with fit accuracy, and becomes repeat customer."}]',
    negativePrompt:
      "Do NOT fabricate persona details without document evidence. Do NOT create generic personas - each must be based on specific user research or customer data mentioned in documents.",
    isRequired: false,
    supportsDiagram: false,
    displayStyle: "auto",
    description: "User personas with profile, needs, pain points, and success definitions",
  },
 
  // === GOVERNANCE ===
  {
    id: "governance",
    name: "Governance",
    fieldKey: "governance",
    type: "default",
    category: "risk_stakeholders",
    enabled: true,
    includeInGeneration: true,
    order: 22,
    valueType: "object",
    instructions:
      'Extract governance structure from documents. Output MUST be an object with two arrays: "approvers" and "reviewers". Each person in both arrays MUST have: "role" (job title like "Digital Product Director"), "responsibility" (what they oversee), "authority" (what they have final say on). The rendered output displays two sections with headings "**Approvers**" and "**Reviewers**", each followed by bullet points formatted as "• **Role** - Responsibility (Authority: authority description)".',
    examples:
      '{"approvers": [{"role": "Digital Product Director", "responsibility": "Overall solution architecture and user experience design", "authority": "Final approval on product requirements and launch readiness"}, {"role": "Brand Marketing Director", "responsibility": "Campaign integration and brand consistency", "authority": "Creative asset approval and editorial content strategy"}, {"role": "Technology Architecture Lead", "responsibility": "Technical implementation and infrastructure decisions", "authority": "System integration and performance standards"}], "reviewers": [{"role": "Digital Product Director", "responsibility": "Overall solution architecture and user experience design", "authority": "Final approval on product requirements and launch readiness"}, {"role": "Brand Marketing Director", "responsibility": "Campaign integration and brand consistency", "authority": "Creative asset approval and editorial content strategy"}, {"role": "Technology Architecture Lead", "responsibility": "Technical implementation and infrastructure decisions", "authority": "System integration and performance standards"}]}',
    negativePrompt:
      "Do NOT fabricate stakeholder roles without document evidence. Do NOT mix approvers and reviewers - keep them in separate arrays.",
    isRequired: false,
    supportsDiagram: false,
    displayStyle: "auto",
    description: "Project governance with approvers and reviewers",
  },
 
  // === NON FUNCTIONAL REQUIREMENTS ===
  {
    id: "nonFunctionalRequirements",
    name: "Non Functional Requirements",
    fieldKey: "nonFunctionalRequirements",
    type: "default",
    category: "technical",
    enabled: true,
    includeInGeneration: true,
    order: 23,
    valueType: "object",
    instructions:
      'Extract non-functional requirements from documents. Output MUST be an object with these category keys: "performanceRequirements", "usabilityAccessibility", "reliabilityAvailability", "securityPrivacy", "dataQualityIntegration". Each category is an array of requirement strings. The rendered output displays each category as a bold heading followed by bullet points. Categories render as: "**Performance Requirements**", "**Usability & Accessibility**", "**Reliability & Availability**", "**Security & Privacy**", "**Data Quality & Integration**".',
    examples:
      '{"performanceRequirements": ["Mobile page load time must remain under 3 seconds despite video content integration", "Video streaming must support progressive loading with 1-second initial frame display", "System must handle 10x current traffic volume during peak shopping periods"], "usabilityAccessibility": ["Video controls must be accessible via keyboard navigation and screen readers", "Alternative text descriptions required for all video content", "Interface must maintain WCAG 2.1 AA compliance standards"], "reliabilityAvailability": ["99.9% uptime requirement for video streaming infrastructure", "Graceful degradation to static images if video fails to load", "Cross-browser compatibility for Chrome, Safari, Firefox, and Edge"], "securityPrivacy": ["Video content must be protected against unauthorized download", "Customer viewing behavior data must comply with Gap Inc. privacy policies", "CDN must support HTTPS encryption for all video streams"], "dataQualityIntegration": ["Real-time synchronization between product catalog and video content", "Automated content tagging for search and recommendation algorithms", "Video engagement metrics must integrate with existing analytics platforms"]}',
    negativePrompt:
      "Do NOT fabricate specific metrics or requirements without document evidence. Include only categories that have relevant requirements from the documents.",
    isRequired: false,
    supportsDiagram: false,
    displayStyle: "auto",
    description: "Non-functional requirements across performance, usability, reliability, security, and data quality",
  },
 
  // === USE CASES ===
  {
    id: "useCases",
    name: "Use Cases",
    fieldKey: "useCases",
    type: "default",
    category: "planning",
    enabled: true,
    includeInGeneration: true,
    order: 24,
    valueType: "array",
    instructions:
      'Extract use cases from documents. Each use case MUST be an object with: "name" (e.g. "Use Case 1: Mobile Customer Evaluating Denim Fit"), "actor" (who performs the action), "goal" (what they want to achieve), "scenario" (step-by-step description of the interaction). The rendered output displays each use case with a bold heading followed by bullet points: "• **Actor:** ...", "• **Goal:** ...", "• **Scenario:** ...". Number use cases sequentially (Use Case 1, Use Case 2, etc.).',
    examples:
      '[{"name": "Use Case 1: Mobile Customer Evaluating Denim Fit", "actor": "Potential Banana Republic customer browsing on mobile device", "goal": "Assess how jeans will fit and look before purchasing", "scenario": "Customer clicks on denim product from campaign ad, views video showing model movement and fabric drape, uses interactive fit guide to compare sizing, and proceeds to purchase with confidence in fit."}]',
    negativePrompt:
      "Do NOT fabricate use cases without document evidence. Each use case must be based on actual user journeys or scenarios described in documents.",
    isRequired: false,
    supportsDiagram: false,
    displayStyle: "auto",
    description: "Use cases with actor, goal, and scenario descriptions",
  },
 
  // === IN-SCOPE - OUT-OF-SCOPE ===
  {
    id: "scopeDefinition",
    name: "In-Scope - Out-of-Scope",
    fieldKey: "scopeDefinition",
    type: "default",
    category: "planning",
    enabled: true,
    includeInGeneration: true,
    order: 25,
    valueType: "object",
    instructions:
      'Extract scope boundaries from documents. Output MUST be an object with two arrays: "inScope" (array of strings for items included) and "outOfScope" (array of strings for items excluded). The rendered output displays two sections with headings "**In Scope**" and "**Out-of-Scope**", each followed by bullet points listing the items.',
    examples:
      '{"inScope": ["Video-first product detail pages for Banana Republic denim collection", "Interactive fit visualization tools and sizing guidance", "Editorial content integration framework for campaign-to-commerce continuity", "Mobile experience optimization for video streaming performance", "Analytics implementation for video engagement and conversion tracking", "Content management system enhancements for video asset organization"], "outOfScope": ["Video content for Old Navy, Gap, and Athleta brands", "Live streaming or real-time video features", "User-generated video content and reviews", "AR/VR virtual try-on experiences", "Video content localization for international markets"]}',
    negativePrompt:
      "Do NOT fabricate scope items without document evidence. Keep in-scope and out-of-scope items clearly separated.",
    isRequired: false,
    supportsDiagram: false,
    displayStyle: "auto",
    description: "Project scope boundaries defining what is included and excluded",
  },
].filter(field => [
  "title",
  "problemStatement",
  "objectives",
  "kpis",
  "successCriteria",
  "keyFeatures",
  "relevantFacts",
  "risks",
  "assumptions",
  "nonFunctionalRequirements",
  "useCases",
  "governance"
].includes(field.id));
 
export function getCategoryDisplayName(category: string): string {
  const names: Record<string, string> = {
    core: "Core",
    planning: "Planning",
    technical: "Technical",
    financial: "Budget, Resources & ROI",
    risk_stakeholders: "Risk & Stakeholders",
    custom: "Custom",
  };
  return names[category] || category;
}
 
export function getCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    core: "Essential fields that define the canvas",
    planning: "Strategic planning and goal-setting",
    technical: "Technology and architecture details",
    financial: "Budget, resources, and ROI",
    risk_stakeholders: "Risk management and stakeholder engagement",
    custom: "User-defined custom fields",
  };
  return descriptions[category] || "";
}