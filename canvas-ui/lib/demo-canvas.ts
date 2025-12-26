import { DEFAULT_CANVAS_FIELDS } from "@/lib/constants/default-canvas-fields";
import type { BusinessCanvas, CanvasField, EvidenceItem } from "@/lib/validators/canvas-schema";

const now = new Date().toISOString();

const sampleEvidence: EvidenceItem[] = [
  {
    source: "Dummy source",
    snippet: "This is placeholder evidence used for the static demo.",
    confidence: 0.72,
    location: "N/A",
  },
];

// Hardcoded demo canvases for dashboard
export const demoCanvases: BusinessCanvas[] = [
  {
    id: "1",
    title: { value: "Market Entry Strategy", evidence: [], confidence: 0.9 },
    problemStatement: { value: "How can we enter the US market?", evidence: [], confidence: 0.8 },
    createdAt: now,
    updatedAt: now,
    bmc_result: {},
    fields: [],
  },
  {
    id: "2",
    title: { value: "Product Launch Plan", evidence: [], confidence: 0.9 },
    problemStatement: { value: "Steps to launch our new app", evidence: [], confidence: 0.8 },
    createdAt: now,
    updatedAt: now,
    bmc_result: {},
    fields: [],
  },
];

function field<T>(value: T, opts?: { evidence?: EvidenceItem[]; confidence?: number }): CanvasField<T> {
  return {
    value,
    evidence: opts?.evidence ?? [],
    confidence: opts?.confidence ?? 0.6,
  };
}

function demoValueForKey(fieldKey: string): unknown {
  switch (fieldKey) {
    case "title":
      return "GAP Inc. Omnichannel Digital Transformation Initiative";
    case "problemStatement":
      return "GAP Inc. faces a 23% YoY decline in in-store foot traffic with a subpar 2.1% online conversion rate (vs 3.5% industry average), resulting in ~$450M.";
    case "solutionRecommendation":
      return {
        value: "Use a single shared canvas to align scope, delivery, and governance.",
        actions: [
          { action: "Run a 45-minute alignment workshop", priority: "high" },
          { action: "Publish weekly decision log updates", priority: "medium" },
          { action: "Review risks and mitigations in a cadence meeting", priority: "medium" },
        ],
        evidence: sampleEvidence,
        confidence: 0.6,
      };
    case "objectives":
      return [
        "Make scope visible to everyone",
        "Capture assumptions + risks early",
        "Align stakeholders on success criteria",
        "Reduce rework from misalignment",
      ];
    case "okrs":
      return [
        {
          id: "okr-1",
          type: "objective",
          title: "Improve delivery predictability",
          description: "Create a shared source of truth for scope and decisions.",
          dueDate: "2026-03-31",
          owner: "Product",
        },
        {
          id: "kr-1",
          type: "key-result",
          title: "Reduce cycle time by 20%",
          description: "Decreasing end-to-end delivery time for major changes.",
          targetValue: "-20%",
          currentValue: "0%",
          parentId: "okr-1",
          dueDate: "2026-03-31",
        },
        {
          id: "kr-2",
          type: "key-result",
          title: "Reduce rework rate by 30%",
          description: "Fewer changes due to misaligned assumptions.",
          targetValue: "-30%",
          currentValue: "0%",
          parentId: "okr-1",
          dueDate: "2026-03-31",
        },
      ];
    case "kpis":
      return [
        "Cycle time: 10d → 8d",
        "Rework rate: 18% → 12%",
        "On-time milestones: 80% → 95%",
        "Stakeholder approval time: 5d → 2d",
      ];
    case "successCriteria":
      return [
        {
          metric: "On-time milestones",
          target: "95% for 2 consecutive months",
          measurement: "Delivered milestones / planned milestones",
        },
        {
          metric: "Rework rate",
          target: "< 12%",
          measurement: "Rework tickets / total tickets",
        },
        {
          metric: "Stakeholder satisfaction",
          target: "≥ 4.5/5",
          measurement: "Monthly stakeholder pulse survey",
        },
      ];
    case "keyFeatures":
      return [
        "Single canvas view with all fields",
        "Editable fields with local autosave",
        "Evidence/notes per field (dummy)",
        "Export as JSON",
      ];
    case "dependencies":
      return ["Design system components", "Internal brand guidelines", "Analytics events schema"];
    case "dataDependencies":
      return ["Project intake form data", "Stakeholder list (CSV)", "Delivery milestones (spreadsheet)"];
    case "technicalArchitecture":
      return [
        {
          layer: "Frontend",
          components: ["Next.js", "React", "Tailwind"],
          description: "Static UI rendering with local state only.",
        },
        {
          layer: "Storage",
          components: ["In-memory state (demo)"],
          description: "No DB; data is hardcoded dummy content.",
        },
      ];
    case "securityCompliance":
      return ["No authentication in demo mode", "No sensitive data stored", "No external network calls"];
    case "budgetResources":
      return {
        totalEstimate: "$120K",
        breakdown: [
          { category: "Engineering", amount: "$80K", notes: "2 engineers for 6 weeks" },
          { category: "Design", amount: "$25K", notes: "1 designer for 5 weeks" },
          { category: "PM", amount: "$15K", notes: "Part-time support" },
        ],
        fteRequirements: "2 engineers, 1 designer, 0.5 PM",
        resourceRequirements: ["Product owner availability", "Weekly stakeholder reviews"],
      };
    case "roiAnalysis":
      return {
        expectedReturn: "$300K annual savings",
        paybackPeriod: "5 months",
        costBenefit: "2.5:1",
        financialJustification: "Reduced rework and faster decision cycles.",
      };
    case "risks":
      return [
        "Unclear ownership → assign RACI early",
        "Scope creep → enforce change control",
        "Stakeholder misalignment → weekly review cadence",
      ];
    case "stakeholderMap":
      return [
        { name: "Alex Rivera", role: "Product Lead", influence: "high", interest: "high", raciRole: "accountable" },
        { name: "Morgan Lee", role: "Engineering Manager", influence: "high", interest: "medium", raciRole: "responsible" },
        { name: "Sam Patel", role: "Security", influence: "medium", interest: "medium", raciRole: "consulted" },
      ];
    case "changeManagement":
      return {
        trainingNeeds: ["Short onboarding guide", "30-minute walkthrough session"],
        communicationPlan: "Weekly updates in the project channel + monthly stakeholder readout.",
        adoptionStrategy: "Start with one pilot team, then expand to others.",
        resistanceMitigation: ["Show quick wins", "Keep templates lightweight"],
      };
    case "assumptions":
      return [
        "Stakeholders can attend a weekly sync",
        "Project goals are stable for 4–6 weeks",
        "Teams will use the canvas as source of truth",
      ];
    case "personas":
      return [
        {
          name: "Persona 1: Delivery Lead",
          profile: "Coordinates multiple teams and needs clarity on scope and dependencies.",
          needs: "Fast visibility into decisions and changes.",
          painPoints: "Rework caused by late requirement changes.",
          successDefinition: "Predictable delivery with minimal last-minute churn.",
        },
        {
          name: "Persona 2: Stakeholder",
          profile: "Approves direction and budgets but has limited time.",
          needs: "Concise status and clear tradeoffs.",
          painPoints: "Information scattered across docs and meetings.",
          successDefinition: "Confident approvals with clear outcomes.",
        },
      ];
    case "governance":
      return {
        approvers: [
          {
            role: "Product Director",
            responsibility: "Overall scope and priorities",
            authority: "Final approval on roadmap and release readiness",
          },
          {
            role: "Engineering Lead",
            responsibility: "Delivery feasibility and technical direction",
            authority: "Final say on architecture and timelines",
          },
        ],
        reviewers: [
          {
            role: "Design Lead",
            responsibility: "UX consistency and usability",
            authority: "Approval on user flows and design standards",
          },
          {
            role: "Security",
            responsibility: "Risk review and compliance",
            authority: "Approval on security requirements",
          },
        ],
      };
    case "nonFunctionalRequirements":
      return {
        performanceRequirements: ["Render under 1s on modern laptops", "No network calls in demo mode"],
        usabilityAccessibility: ["Keyboard navigable UI", "Readable contrast and spacing"],
        reliabilityAvailability: ["Works offline once built", "No backend dependencies"],
        securityPrivacy: ["No auth or user data stored", "No external tokens or secrets used"],
        dataQualityIntegration: ["Dummy data only", "No integrations"],
      };
    case "useCases":
      return [
        {
          name: "Use Case 1: Stakeholder reviews scope",
          actor: "Stakeholder",
          goal: "Understand scope and approve direction",
          scenario: "Opens canvas, scans objectives, risks, and scope boundaries, then exports JSON for sharing.",
        },
        {
          name: "Use Case 2: Team updates a field",
          actor: "Delivery lead",
          goal: "Record a new risk and mitigation",
          scenario: "Edits the Risks field, adds a mitigation, and continues working locally.",
        },
      ];
    case "scopeDefinition":
      return {
        inScope: ["Static canvas UI", "Edit fields locally", "Export JSON"],
        outOfScope: ["Authentication", "Database persistence", "LLM generation", "File uploads", "Collaboration"],
      };
    default:
      return "";
  }
}

function buildDemoCanvas(): BusinessCanvas {
  const base: Record<string, unknown> = {
    id: DEMO_CANVAS_ID,
    createdAt: now,
    updatedAt: now,
  };

  for (const config of DEFAULT_CANVAS_FIELDS) {
    const value = demoValueForKey(config.fieldKey);
    const evidence = config.fieldKey === "problemStatement" ? sampleEvidence : [];
    base[config.fieldKey] = field(value, { evidence, confidence: config.fieldKey === "title" ? 0.85 : 0.6 });
  }

  // Ensure solutionRecommendation is the special object shape (it already matches CanvasField shape).
  base.solutionRecommendation = demoValueForKey("solutionRecommendation");

  return base as BusinessCanvas;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const DEMO_CANVAS_ID = "demo";

export function getDemoCanvas(id: string = DEMO_CANVAS_ID): BusinessCanvas {
  const base = buildDemoCanvas();
  const canvas = deepClone(base);
  canvas.id = id;
  canvas.createdAt = now;
  canvas.updatedAt = now;
  return canvas as BusinessCanvas;
}

