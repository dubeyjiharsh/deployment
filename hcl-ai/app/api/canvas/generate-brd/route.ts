import { NextRequest, NextResponse } from "next/server";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import { auth } from "@/lib/auth";
import { getCanvasById, saveCanvas } from "@/services/database/canvas-repository";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { BusinessCanvas } from "@/lib/validators/canvas-schema";
import type {
  BRDDocument,
  BRDFeature,
  NFR,
  UseCase,
  ScopeItem,
  BRDRisk,
  BRDKeyResult,
} from "@/lib/validators/brd-schema";
import { userRepository } from "@/services/database/user-repository";

// Extended canvas type with stories and BRD
type ExtendedCanvas = BusinessCanvas & {
  stories?: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    acceptanceCriteria?: string[];
    priority?: string;
  }>;
  brd?: BRDDocument;
};

const requestSchema = z.object({
  canvasId: z.string(),
  metadata: z.object({
    brdOwner: z.string().min(1, "BRD Owner is required"),
    programName: z.string().min(1, "Program Name is required"),
    portfolioEpic: z.string().optional(),
  }),
  regenerate: z.boolean().optional(),
});

/**
 * POST /api/canvas/generate-brd
 * Generates a comprehensive BRD document from canvas data
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log("🚀 Starting BRD Generation");

  // Apply authentication and rate limiting
  const { response } = await applyApiMiddleware(request, MIDDLEWARE_PRESETS.AI);
  if (response) {
    console.log("⛔ Middleware blocked request");
    return response;
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = requestSchema.parse(body);

    console.log("🎯 Generate BRD - Canvas ID:", validated.canvasId);

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

    // Load canvas
    const canvas = (await getCanvasById(validated.canvasId)) as ExtendedCanvas | null;
    if (!canvas) {
      console.error("❌ Canvas not found:", validated.canvasId);
      return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
    }

    console.log("✅ Canvas loaded successfully");

    // Build comprehensive context from canvas
    const context = buildCanvasContext(canvas);

    if (!context.problemStatement) {
      return NextResponse.json(
        { error: "Canvas requires at least a problem statement to generate a BRD" },
        { status: 400 }
      );
    }

    // Import AI SDK
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    const { generateText } = await import("ai");
    const { settingsRepository } = await import(
      "@/services/database/settings-repository"
    );

    const settings = await settingsRepository.getSettings();
    const apiKey = settings?.claudeApiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("Claude API key not configured");
    }

    const anthropic = createAnthropic({ apiKey });

    // Generate BRD sections using AI
    console.log("🤖 Generating BRD content with AI...");

    const brdPrompt = buildBRDPrompt(context, validated.metadata);

    const { text: aiResponse } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt: brdPrompt,
      temperature: 0.7,
      maxOutputTokens: 8000,
    });

    // Parse AI response
    let brdContent;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        brdContent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch {
      console.error("Failed to parse AI response:", aiResponse);
      throw new Error("Failed to parse BRD content from AI response");
    }

    // Build the complete BRD document
    const now = new Date().toISOString();
    const brd: BRDDocument = {
      id: nanoid(),
      canvasId: validated.canvasId,
      generatedAt: now,
      updatedAt: now,
      metadata: {
        brdOwner: validated.metadata.brdOwner,
        programName: validated.metadata.programName,
        portfolioEpic: validated.metadata.portfolioEpic,
        version: "1.0",
      },
      executiveSummary: {
        title: "Executive Summary",
        content: brdContent.executiveSummary || "",
      },
      objective: {
        businessGoal: brdContent.objective?.businessGoal || "",
        what: brdContent.objective?.what || "",
        why: brdContent.objective?.why || "",
        impact: brdContent.objective?.impact || "",
      },
      successCriteria: (brdContent.successCriteria || []).map(
        (sc: { objective: string; keyResults: string[] }) => ({
          id: nanoid(),
          objective: sc.objective,
          keyResults: sc.keyResults || [],
        })
      ) as BRDKeyResult[],
      useCases: (brdContent.useCases || []).map(
        (uc: { description: string; priority: string }) => ({
          id: nanoid(),
          description: uc.description,
          priority: uc.priority || "P2",
        })
      ) as UseCase[],
      scope: (brdContent.scope || []).map(
        (s: { description: string; category: string }) => ({
          id: nanoid(),
          description: s.description,
          category: s.category || "in_scope",
        })
      ) as ScopeItem[],
      nonFunctionalRequirements: (brdContent.nonFunctionalRequirements || []).map(
        (nfr: {
          category: string;
          requirement: string;
          acceptanceCriteria: string;
          priority: string;
        }) => ({
          id: nanoid(),
          category: nfr.category || "Other",
          requirement: nfr.requirement,
          acceptanceCriteria: nfr.acceptanceCriteria,
          priority: nfr.priority || "P2",
        })
      ) as NFR[],
      assumptions: brdContent.assumptions || [],
      constraints: brdContent.constraints || [],
      risks: (brdContent.risks || []).map(
        (r: { risk: string; mitigation: string }) => ({
          id: nanoid(),
          risk: r.risk,
          mitigation: r.mitigation,
        })
      ) as BRDRisk[],
      features: (brdContent.features || []).map(
        (f: {
          name: string;
          description: string;
          businessRequirements: string;
          dataRequirements?: string;
          acceptanceCriteria: string;
          priority: string;
        }) => ({
          id: nanoid(),
          name: f.name,
          description: f.description,
          businessRequirements: f.businessRequirements,
          dataRequirements: f.dataRequirements,
          acceptanceCriteria: f.acceptanceCriteria,
          priority: f.priority || "P2",
        })
      ) as BRDFeature[],
      completeness: {
        percentage: 0,
        missingFields: [],
      },
    };

    // Calculate completeness
    const missingFields: string[] = [];
    if (!brd.metadata.brdApprover) missingFields.push("BRD Approver");
    if (!brd.metadata.approvalDate) missingFields.push("Approval Date");
    if (!brd.metadata.signOffApprovers?.length) missingFields.push("Sign-off Approvers");
    if (!brd.metadata.reviewers?.length) missingFields.push("Reviewers");
    if (!brd.metadata.glossaryTerms?.length) missingFields.push("Glossary Terms");

    brd.completeness = {
      percentage: Math.round(((6 - missingFields.length) / 6) * 100),
      missingFields,
    };

    // Save BRD to canvas
    const updatedCanvas = {
      ...canvas,
      brd,
      updatedAt: now,
    };

    await saveCanvas(updatedCanvas, session.user.id, "Generated BRD document");

    console.log("✅ BRD generated successfully");

    return NextResponse.json({ brd });
  } catch (error) {
    console.error("❌ Error generating BRD:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to generate BRD" },
      { status: 500 }
    );
  }
}

/**
 * Build context from canvas data
 */
function buildCanvasContext(canvas: ExtendedCanvas): {
  problemStatement: string;
  title: string;
  objectives: string[];
  kpis: string[];
  risks: string[];
  features: string[];
  dependencies: string[];
  dataDependencies: string[];
  assumptions: string[];
  technicalArchitecture: string;
  securityCompliance: string[];
  successCriteria: string[];
  stories: Array<{
    type: string;
    title: string;
    description: string;
    acceptanceCriteria?: string[];
    priority?: string;
  }>;
} {
  // Extract values from canvas fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getValue = <T>(field: any): T | undefined => {
    if (!field || typeof field !== "object") return undefined;
    return field.value ?? undefined;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getArrayValue = (field: any): string[] => {
    const val = getValue<string[]>(field);
    return Array.isArray(val) ? val : [];
  };

  return {
    problemStatement: getValue(canvas.problemStatement) || "",
    title: getValue(canvas.title) || "",
    objectives: getArrayValue(canvas.objectives),
    kpis: getArrayValue(canvas.kpis),
    risks: getArrayValue(canvas.risks),
    features: getArrayValue(canvas.keyFeatures),
    dependencies: getArrayValue(canvas.dependencies),
    dataDependencies: getArrayValue(canvas.dataDependencies),
    assumptions: getArrayValue(canvas.assumptions),
    technicalArchitecture: (() => {
      const arch = getValue(canvas.technicalArchitecture);
      if (Array.isArray(arch)) {
        return arch
          .map(
            (a: { layer: string; components: string[] }) =>
              `${a.layer}: ${a.components.join(", ")}`
          )
          .join("; ");
      }
      return "";
    })(),
    securityCompliance: getArrayValue(canvas.securityCompliance),
    successCriteria: (() => {
      const criteria = getValue(canvas.successCriteria);
      if (Array.isArray(criteria)) {
        return criteria.map(
          (c: { metric: string; target: string }) => `${c.metric}: ${c.target}`
        );
      }
      return [];
    })(),
    stories: canvas.stories || [],
  };
}

/**
 * Build the BRD generation prompt
 */
function buildBRDPrompt(
  context: ReturnType<typeof buildCanvasContext>,
  metadata: { brdOwner: string; programName: string; portfolioEpic?: string }
): string {
  const storiesContext =
    context.stories.length > 0
      ? `
Stories/Epics/Features from canvas:
${context.stories
  .map(
    (s) =>
      `- [${s.type.toUpperCase()}] ${s.title}: ${s.description}${
        s.acceptanceCriteria?.length
          ? `\n  Acceptance Criteria: ${s.acceptanceCriteria.join("; ")}`
          : ""
      }${s.priority ? ` (Priority: ${s.priority})` : ""}`
  )
  .join("\n")}`
      : "";

  return `You are a business analyst generating a comprehensive Business Requirements Document (BRD).

Based on the following canvas data, generate a complete BRD in JSON format.

CANVAS CONTEXT:
Title: ${context.title}
Program: ${metadata.programName}

Problem Statement:
${context.problemStatement}

${context.objectives.length > 0 ? `Objectives:\n${context.objectives.map((o) => `- ${o}`).join("\n")}` : ""}

${context.kpis.length > 0 ? `KPIs:\n${context.kpis.map((k) => `- ${k}`).join("\n")}` : ""}

${context.features.length > 0 ? `Key Features:\n${context.features.map((f) => `- ${f}`).join("\n")}` : ""}

${context.risks.length > 0 ? `Risks:\n${context.risks.map((r) => `- ${r}`).join("\n")}` : ""}

${context.dependencies.length > 0 ? `Dependencies:\n${context.dependencies.map((d) => `- ${d}`).join("\n")}` : ""}

${context.dataDependencies.length > 0 ? `Data Dependencies:\n${context.dataDependencies.map((d) => `- ${d}`).join("\n")}` : ""}

${context.assumptions.length > 0 ? `Assumptions:\n${context.assumptions.map((a) => `- ${a}`).join("\n")}` : ""}

${context.technicalArchitecture ? `Technical Architecture: ${context.technicalArchitecture}` : ""}

${context.securityCompliance.length > 0 ? `Security & Compliance:\n${context.securityCompliance.map((s) => `- ${s}`).join("\n")}` : ""}

${context.successCriteria.length > 0 ? `Success Criteria:\n${context.successCriteria.map((s) => `- ${s}`).join("\n")}` : ""}

${storiesContext}

Generate a BRD with the following structure. Return ONLY valid JSON with no additional text:

{
  "executiveSummary": "A comprehensive executive summary (2-3 paragraphs) that outlines the foundational capability, business goal, key systems involved, and expected benefits.",

  "objective": {
    "businessGoal": "The overarching business goal (1-2 sentences)",
    "what": "Detailed description of WHAT needs to be built/implemented (1-2 paragraphs)",
    "why": "Explanation of WHY this is needed and the business drivers (1-2 paragraphs)",
    "impact": "Expected business IMPACT with bullet points of benefits"
  },

  "successCriteria": [
    {
      "objective": "Objective description",
      "keyResults": ["Key result 1", "Key result 2", "Key result 3"]
    }
  ],

  "useCases": [
    {
      "description": "Use case description",
      "priority": "P1"
    }
  ],

  "scope": [
    {
      "description": "Scope item description",
      "category": "in_scope"
    },
    {
      "description": "Out of scope item",
      "category": "out_of_scope"
    },
    {
      "description": "Undecided item",
      "category": "undecided"
    }
  ],

  "nonFunctionalRequirements": [
    {
      "category": "Performance",
      "requirement": "The system shall...",
      "acceptanceCriteria": "Specific measurable criteria",
      "priority": "P1"
    },
    {
      "category": "Security",
      "requirement": "Data encryption requirement",
      "acceptanceCriteria": "AES-256 encryption at rest",
      "priority": "P1"
    },
    {
      "category": "Scalability",
      "requirement": "Scalability requirement",
      "acceptanceCriteria": "Handle 10x current load",
      "priority": "P2"
    },
    {
      "category": "Availability",
      "requirement": "Uptime requirement",
      "acceptanceCriteria": "99.9% SLA",
      "priority": "P1"
    }
  ],

  "assumptions": [
    "Assumption 1",
    "Assumption 2"
  ],

  "constraints": [
    "Constraint 1",
    "Constraint 2"
  ],

  "risks": [
    {
      "risk": "Risk description",
      "mitigation": "Mitigation strategy"
    }
  ],

  "features": [
    {
      "name": "Feature Name",
      "description": "Feature description",
      "businessRequirements": "Business requirements for this feature",
      "dataRequirements": "Data requirements (optional)",
      "acceptanceCriteria": "Specific acceptance criteria",
      "priority": "P1"
    }
  ]
}

IMPORTANT GUIDELINES:
1. Generate 3-5 objectives with 2-4 key results each
2. Generate 4-8 use cases based on the problem statement and features
3. Generate at least 3 in-scope items, 2 out-of-scope items, and 1 undecided item
4. Generate at least 6 NFRs covering Performance, Security, Scalability, Availability, and other relevant categories
5. Generate 3-5 assumptions and 2-4 constraints
6. Generate 3-5 risks with specific mitigations
7. Generate 5-10 features based on the canvas key features and stories
8. Use P1 for critical, P2 for important, P3 for nice-to-have, P4 for future
9. Be specific and actionable - avoid generic statements
10. If stories/features exist from the canvas, incorporate them into the features section with more detail

Return ONLY the JSON object, no markdown formatting or additional text.`;
}
