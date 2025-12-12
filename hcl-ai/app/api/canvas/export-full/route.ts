import { NextRequest, NextResponse } from "next/server";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import { auth } from "@/lib/auth";
import { getCanvasById } from "@/services/database/canvas-repository";
import { z } from "zod";
import { userRepository } from "@/services/database/user-repository";
import type { BusinessCanvas, CanvasField } from "@/lib/validators/canvas-schema";
import type { Story, ExecutionPlan, OKR } from "@/stores/canvas-store";
import type { Benchmark } from "@/lib/validators/canvas-schema";

// Extended canvas type with all related data
type ExtendedCanvas = BusinessCanvas & {
  stories?: Story[];
  executionPlan?: ExecutionPlan;
  benchmarks?: Benchmark[];
  okrsList?: OKR[];
};

const requestSchema = z.object({
  canvasId: z.string(),
  format: z.enum(["pdf", "docx"]),
  // Optional: include sections
  includeSections: z.object({
    canvas: z.boolean().default(true),
    research: z.boolean().default(true),
    epics: z.boolean().default(true),
    benchmarks: z.boolean().default(true),
    executionPlan: z.boolean().default(true),
  }).optional(),
  // Client-side store data (stories, benchmarks, execution plan are not stored in DB)
  stories: z.array(z.object({
    id: z.string(),
    type: z.enum(["epic", "feature", "user-story", "dev-story"]),
    title: z.string(),
    description: z.string(),
    acceptanceCriteria: z.array(z.string()).optional(),
    priority: z.enum(["high", "medium", "low"]).optional(),
    storyPoints: z.number().optional(),
    epic: z.string().optional(),
    feature: z.string().optional(),
    parentOKR: z.string().optional(),
    originRequirement: z.string().optional(),
  })).optional(),
  benchmarks: z.array(z.object({
    metric: z.string(),
    yourValue: z.string(),
    industryAverage: z.string(),
    topPerformers: z.string(),
    assessment: z.enum(["above", "at", "below"]),
    recommendation: z.string().optional(),
  })).optional(),
  executionPlan: z.object({
    sprints: z.array(z.object({
      id: z.string(),
      name: z.string(),
      goal: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      stories: z.array(z.string()),
      capacity: z.number(),
      velocity: z.number().optional(),
    })),
    resources: z.array(z.object({
      id: z.string(),
      type: z.enum(["people", "budget", "tools", "infrastructure"]),
      name: z.string(),
      description: z.string(),
      allocation: z.string(),
      cost: z.string().optional(),
      timeline: z.string().optional(),
    })),
  }).nullable().optional(),
});

/**
 * POST /api/canvas/export-full
 * Exports the full canvas as PDF or Word document including all sections
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log("🚀 Starting Full Canvas Export");

  // Apply authentication and rate limiting
  const { response } = await applyApiMiddleware(request, MIDDLEWARE_PRESETS.AUTH);
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

    console.log("🎯 Export Canvas - Canvas ID:", validated.canvasId, "Format:", validated.format);

    // Load canvas
    const canvas = (await getCanvasById(validated.canvasId)) as ExtendedCanvas | null;
    if (!canvas) {
      console.error("❌ Canvas not found:", validated.canvasId);
      return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
    }

    // Authorization: only owners/shared users (or admins) can export
    const user = await userRepository.getUserById(session.user.id);
    const isAdmin = user?.role === "admin";
    const hasAccess = isAdmin || await userRepository.canUserAccessCanvas(validated.canvasId, session.user.id);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You don't have access to this canvas" },
        { status: 403 }
      );
    }

    console.log("✅ Canvas loaded successfully");

    const sections = validated.includeSections || {
      canvas: true,
      research: true,
      epics: true,
      benchmarks: true,
      executionPlan: true,
    };

    // Merge client-side store data into canvas for export
    const exportCanvas: ExtendedCanvas = {
      ...canvas,
      stories: validated.stories || [],
      benchmarks: validated.benchmarks || [],
      executionPlan: validated.executionPlan || undefined,
    };

    const title = getFieldValue(canvas.title) || "Business Canvas";

    if (validated.format === "pdf") {
      const pdfBuffer = await generatePDF(exportCanvas, title, sections);

      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${title.replace(/\s+/g, "_")}_Canvas.pdf"`,
        },
      });
    } else {
      const docxBuffer = await generateDocx(exportCanvas, title, sections);

      return new NextResponse(new Uint8Array(docxBuffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${title.replace(/\s+/g, "_")}_Canvas.docx"`,
        },
      });
    }
  } catch (error) {
    console.error("❌ Error exporting canvas:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to export canvas" }, { status: 500 });
  }
}

// Helper to get field value
function getFieldValue<T>(field: CanvasField<T> | undefined | null): T | null {
  if (!field) return null;
  return field.value;
}

// Helper to format array values
function formatArrayValue(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(item => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null) {
        // Handle objects with common properties
        const obj = item as Record<string, unknown>;
        if ("name" in obj) return String(obj.name);
        if ("title" in obj) return String(obj.title);
        if ("description" in obj) return String(obj.description);
        return JSON.stringify(obj);
      }
      return String(item);
    });
  }
  if (typeof value === "string") return [value];
  return [];
}

interface IncludeSections {
  canvas: boolean;
  research: boolean;
  epics: boolean;
  benchmarks: boolean;
  executionPlan: boolean;
}

/**
 * Generate PDF from Canvas
 */
async function generatePDF(
  canvas: ExtendedCanvas,
  title: string,
  sections: IncludeSections
): Promise<Buffer> {
    const { jsPDF } = await import("jspdf/dist/jspdf.umd.min.js");

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let y = 20;

  // Helper function to add text with word wrap
  const addText = (text: string, fontSize: number, isBold: boolean = false): void => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, contentWidth);

    const lineHeight = fontSize * 0.5;
    if (y + lines.length * lineHeight > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }

    doc.text(lines, margin, y);
    y += lines.length * lineHeight + 5;
  };

  const addHeading = (text: string, level: 1 | 2 | 3): void => {
    const sizes = { 1: 18, 2: 14, 3: 12 };
    if (level === 1) y += 5;
    addText(text, sizes[level], true);
    if (level === 1) y += 3;
  };

  const addParagraph = (text: string): void => {
    addText(text, 10);
  };

  const addListItem = (text: string): void => {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const bullet = "• ";
    const lines = doc.splitTextToSize(text, contentWidth - 10);

    if (y + lines.length * 5 > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }

    doc.text(bullet + lines[0], margin, y);
    for (let i = 1; i < lines.length; i++) {
      y += 5;
      doc.text("  " + lines[i], margin, y);
    }
    y += 7;
  };

  const addSeparator = (): void => {
    y += 3;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
  };

  // Title Page
  addHeading(`${title}`, 1);
  addParagraph(`Status: ${canvas.status}`);
  addParagraph(`Generated: ${new Date().toLocaleDateString("en-GB")}`);
  addParagraph(`Created: ${new Date(canvas.createdAt).toLocaleDateString("en-GB")}`);
  addParagraph(`Last Updated: ${new Date(canvas.updatedAt).toLocaleDateString("en-GB")}`);

  addSeparator();

  // Canvas Fields Section
  if (sections.canvas) {
    // Problem Statement
    const problemStatement = getFieldValue(canvas.problemStatement);
    if (problemStatement) {
      addHeading("Problem Statement", 1);
      addParagraph(problemStatement);
      const problemEvidence = canvas.problemStatement?.evidence;
      if (problemEvidence && problemEvidence.length > 0) {
        addHeading("Supporting Evidence", 3);
        problemEvidence.forEach(e => addListItem(`${e.snippet} (${e.source})`));
      }
      addSeparator();
    }

    // Objectives
    const objectives = formatArrayValue(getFieldValue(canvas.objectives));
    if (objectives.length > 0) {
      addHeading("Objectives", 1);
      objectives.forEach(obj => addListItem(obj));
      addSeparator();
    }

    // KPIs
    const kpis = formatArrayValue(getFieldValue(canvas.kpis));
    if (kpis.length > 0) {
      addHeading("Key Performance Indicators (KPIs)", 1);
      kpis.forEach(kpi => addListItem(kpi));
      addSeparator();
    }

    // Urgency
    const urgency = getFieldValue(canvas.urgency);
    if (urgency) {
      addHeading("Urgency Level", 2);
      addParagraph(String(urgency).toUpperCase());
      addSeparator();
    }

    // Key Features
    const keyFeatures = formatArrayValue(getFieldValue(canvas.keyFeatures));
    if (keyFeatures.length > 0) {
      addHeading("Key Features", 1);
      keyFeatures.forEach(feature => addListItem(feature));
      addSeparator();
    }

    // Dependencies
    const dependencies = formatArrayValue(getFieldValue(canvas.dependencies));
    if (dependencies.length > 0) {
      addHeading("Dependencies", 1);
      dependencies.forEach(dep => addListItem(dep));
      addSeparator();
    }

    // Data Dependencies
    const dataDependencies = formatArrayValue(getFieldValue(canvas.dataDependencies));
    if (dataDependencies.length > 0) {
      addHeading("Data Dependencies", 1);
      dataDependencies.forEach(dep => addListItem(dep));
      addSeparator();
    }

    // Risks
    const risks = formatArrayValue(getFieldValue(canvas.risks));
    if (risks.length > 0) {
      addHeading("Risks", 1);
      risks.forEach(risk => addListItem(risk));
      addSeparator();
    }

    // Assumptions
    const assumptions = formatArrayValue(getFieldValue(canvas.assumptions));
    if (assumptions.length > 0) {
      addHeading("Assumptions", 1);
      assumptions.forEach(assumption => addListItem(assumption));
      addSeparator();
    }

    // Technical Architecture
    const techArch = getFieldValue(canvas.technicalArchitecture);
    if (techArch) {
      addHeading("Technical Architecture", 1);
      if (Array.isArray(techArch)) {
        techArch.forEach((item) => {
          if (typeof item === "object" && item !== null) {
            const component = item as Record<string, unknown>;
            if (component.layer) {
              addHeading(String(component.layer), 3);
            }
            if (component.components && Array.isArray(component.components)) {
              (component.components as string[]).forEach(c => addListItem(c));
            }
            if (component.description) {
              addParagraph(String(component.description));
            }
          } else if (typeof item === "string") {
            addListItem(item);
          }
        });
      } else if (typeof techArch === "string") {
        addParagraph(techArch);
      }
      addSeparator();
    }

    // Security & Compliance
    const security = formatArrayValue(getFieldValue(canvas.securityCompliance));
    if (security.length > 0) {
      addHeading("Security & Compliance", 1);
      security.forEach(item => addListItem(item));
      addSeparator();
    }

    // Stakeholders
    const stakeholders = getFieldValue(canvas.stakeholderMap);
    if (stakeholders && Array.isArray(stakeholders) && stakeholders.length > 0) {
      addHeading("Stakeholder Map", 1);
      stakeholders.forEach((item) => {
        if (typeof item === "object" && item !== null) {
          const s = item as Record<string, unknown>;
          const name = s.name || "Unknown";
          const role = s.role || "";
          const influence = s.influence || "";
          const interest = s.interest || "";
          addListItem(`${name} - ${role} (Influence: ${influence}, Interest: ${interest})`);
        }
      });
      addSeparator();
    }

    // Budget & Resources
    const budget = getFieldValue(canvas.budgetResources);
    if (budget && typeof budget === "object") {
      addHeading("Budget & Resources", 1);
      const b = budget as Record<string, unknown>;
      if (b.totalEstimate) addParagraph(`Total Estimate: ${b.totalEstimate}`);
      if (b.fteRequirements) addParagraph(`FTE Requirements: ${b.fteRequirements}`);
      if (b.breakdown && Array.isArray(b.breakdown)) {
        addHeading("Breakdown", 3);
        (b.breakdown as Array<{ category: string; amount: string; notes?: string }>).forEach(item => {
          addListItem(`${item.category}: ${item.amount}${item.notes ? ` - ${item.notes}` : ""}`);
        });
      }
      addSeparator();
    }

    // ROI Analysis
    const roi = getFieldValue(canvas.roiAnalysis);
    if (roi && typeof roi === "object") {
      addHeading("ROI Analysis", 1);
      const r = roi as Record<string, unknown>;
      if (r.expectedReturn) addParagraph(`Expected Return: ${r.expectedReturn}`);
      if (r.paybackPeriod) addParagraph(`Payback Period: ${r.paybackPeriod}`);
      if (r.costBenefit) addParagraph(`Cost/Benefit: ${r.costBenefit}`);
      if (r.financialJustification) addParagraph(`Financial Justification: ${r.financialJustification}`);
      addSeparator();
    }

    // Timelines
    const timelines = getFieldValue(canvas.timelines);
    if (timelines && typeof timelines === "object") {
      addHeading("Timelines", 1);
      const t = timelines as Record<string, unknown>;
      if (t.start) addParagraph(`Start: ${t.start}`);
      if (t.end) addParagraph(`End: ${t.end}`);
      if (t.milestones && Array.isArray(t.milestones)) {
        addHeading("Milestones", 3);
        (t.milestones as Array<{ name: string; date?: string; description?: string }>).forEach(m => {
          addListItem(`${m.name}${m.date ? ` (${m.date})` : ""}${m.description ? ` - ${m.description}` : ""}`);
        });
      }
      addSeparator();
    }

    // Solution Recommendation
    const solution = canvas.solutionRecommendation;
    if (solution) {
      addHeading("Solution Recommendation", 1);
      if (solution.value) {
        if (typeof solution.value === "string") {
          addParagraph(solution.value);
        } else if (typeof solution.value === "object") {
          addParagraph(JSON.stringify(solution.value, null, 2));
        }
      }
      if (solution.actions && solution.actions.length > 0) {
        addHeading("Recommended Actions", 3);
        solution.actions.forEach(action => {
          if (typeof action === "string") {
            addListItem(action);
          } else if (typeof action === "object" && action !== null) {
            const a = action as { action?: string; priority?: string; owner?: string };
            addListItem(`${a.action || ""}${a.priority ? ` [${a.priority}]` : ""}${a.owner ? ` - Owner: ${a.owner}` : ""}`);
          }
        });
      }
      addSeparator();
    }

    // Alignment with Long-term Strategy
    const alignment = getFieldValue(canvas.alignmentLongTerm);
    if (alignment) {
      addHeading("Strategic Alignment", 1);
      if (typeof alignment === "string") {
        addParagraph(alignment);
      } else {
        addParagraph(JSON.stringify(alignment, null, 2));
      }
      addSeparator();
    }
  }

  // Research Section
  if (sections.research && canvas.research) {
    doc.addPage();
    y = margin;

    addHeading("Research Report", 1);
    addParagraph(`Generated: ${new Date(canvas.research.generatedAt).toLocaleDateString("en-GB")}`);
    addSeparator();

    // Competitor Analysis
    if (canvas.research.competitorAnalysis) {
      addHeading(canvas.research.competitorAnalysis.title || "Competitor Analysis", 2);
      addParagraph(canvas.research.competitorAnalysis.content);
      if (canvas.research.competitorAnalysis.sources?.length > 0) {
        addHeading("Sources", 3);
        canvas.research.competitorAnalysis.sources.forEach(s => addListItem(`${s.title}: ${s.url}`));
      }
      addSeparator();
    }

    // Internal Applications
    if (canvas.research.internalApplications) {
      addHeading(canvas.research.internalApplications.title || "Internal Applications", 2);
      addParagraph(canvas.research.internalApplications.content);
      if (canvas.research.internalApplications.sources?.length > 0) {
        addHeading("Sources", 3);
        canvas.research.internalApplications.sources.forEach(s => addListItem(`${s.title}: ${s.url}`));
      }
      addSeparator();
    }

    // Industry Benchmarks
    if (canvas.research.industryBenchmarks) {
      addHeading(canvas.research.industryBenchmarks.title || "Industry Benchmarks", 2);
      addParagraph(canvas.research.industryBenchmarks.content);
      if (canvas.research.industryBenchmarks.sources?.length > 0) {
        addHeading("Sources", 3);
        canvas.research.industryBenchmarks.sources.forEach(s => addListItem(`${s.title}: ${s.url}`));
      }
      addSeparator();
    }

    // Estimated Impact
    if (canvas.research.estimatedImpact) {
      addHeading(canvas.research.estimatedImpact.title || "Estimated Impact", 2);
      addParagraph(canvas.research.estimatedImpact.content);
      if (canvas.research.estimatedImpact.sources?.length > 0) {
        addHeading("Sources", 3);
        canvas.research.estimatedImpact.sources.forEach(s => addListItem(`${s.title}: ${s.url}`));
      }
      addSeparator();
    }

    // Recommendations
    if (canvas.research.recommendations) {
      addHeading(canvas.research.recommendations.title || "Recommendations", 2);
      addParagraph(canvas.research.recommendations.content);
      if (canvas.research.recommendations.sources?.length > 0) {
        addHeading("Sources", 3);
        canvas.research.recommendations.sources.forEach(s => addListItem(`${s.title}: ${s.url}`));
      }
      addSeparator();
    }

    // Strategic Implications
    if (canvas.research.strategicImplications) {
      addHeading(canvas.research.strategicImplications.title || "Strategic Implications", 2);
      addParagraph(canvas.research.strategicImplications.content);
      if (canvas.research.strategicImplications.sources && canvas.research.strategicImplications.sources.length > 0) {
        addHeading("Sources", 3);
        canvas.research.strategicImplications.sources.forEach(s => addListItem(`${s.title}: ${s.url}`));
      }
      addSeparator();
    }
  }

  // Epics/Stories Section
  if (sections.epics && canvas.stories && canvas.stories.length > 0) {
    doc.addPage();
    y = margin;

    addHeading("Epics & User Stories", 1);

    const epics = canvas.stories.filter(s => s.type === "epic");
    const features = canvas.stories.filter(s => s.type === "feature");
    const userStories = canvas.stories.filter(s => s.type === "user-story");
    const devStories = canvas.stories.filter(s => s.type === "dev-story");

    if (epics.length > 0) {
      addHeading("Epics", 2);
      epics.forEach(epic => {
        addHeading(`${epic.title}${epic.priority ? ` [${epic.priority}]` : ""}`, 3);
        addParagraph(epic.description);
        if (epic.acceptanceCriteria && epic.acceptanceCriteria.length > 0) {
          epic.acceptanceCriteria.forEach(ac => addListItem(ac));
        }
        y += 5;
      });
      addSeparator();
    }

    if (features.length > 0) {
      addHeading("Features", 2);
      features.forEach(feature => {
        addHeading(`${feature.title}${feature.priority ? ` [${feature.priority}]` : ""}`, 3);
        if (feature.epic) addParagraph(`Epic: ${feature.epic}`);
        addParagraph(feature.description);
        if (feature.acceptanceCriteria && feature.acceptanceCriteria.length > 0) {
          feature.acceptanceCriteria.forEach(ac => addListItem(ac));
        }
        y += 5;
      });
      addSeparator();
    }

    if (userStories.length > 0) {
      addHeading("User Stories", 2);
      userStories.forEach(story => {
        const points = story.storyPoints ? ` (${story.storyPoints} pts)` : "";
        addHeading(`${story.title}${story.priority ? ` [${story.priority}]` : ""}${points}`, 3);
        if (story.feature) addParagraph(`Feature: ${story.feature}`);
        addParagraph(story.description);
        if (story.acceptanceCriteria && story.acceptanceCriteria.length > 0) {
          story.acceptanceCriteria.forEach(ac => addListItem(ac));
        }
        y += 5;
      });
      addSeparator();
    }

    if (devStories.length > 0) {
      addHeading("Development Stories", 2);
      devStories.forEach(story => {
        const points = story.storyPoints ? ` (${story.storyPoints} pts)` : "";
        addHeading(`${story.title}${story.priority ? ` [${story.priority}]` : ""}${points}`, 3);
        if (story.feature) addParagraph(`Feature: ${story.feature}`);
        addParagraph(story.description);
        if (story.acceptanceCriteria && story.acceptanceCriteria.length > 0) {
          story.acceptanceCriteria.forEach(ac => addListItem(ac));
        }
        y += 5;
      });
    }
  }

  // Benchmarks Section
  if (sections.benchmarks && canvas.benchmarks && canvas.benchmarks.length > 0) {
    doc.addPage();
    y = margin;

    addHeading("Industry Benchmarks", 1);

    canvas.benchmarks.forEach(benchmark => {
      addHeading(benchmark.metric, 3);
      addParagraph(`Your Value: ${benchmark.yourValue}`);
      addParagraph(`Industry Average: ${benchmark.industryAverage}`);
      addParagraph(`Top Performers: ${benchmark.topPerformers}`);
      addParagraph(`Assessment: ${benchmark.assessment.toUpperCase()}`);
      if (benchmark.recommendation) {
        addParagraph(`Recommendation: ${benchmark.recommendation}`);
      }
      y += 5;
    });
  }

  // Execution Plan Section
  if (sections.executionPlan && canvas.executionPlan) {
    doc.addPage();
    y = margin;

    addHeading("Execution Plan", 1);

    if (canvas.executionPlan.sprints && canvas.executionPlan.sprints.length > 0) {
      addHeading("Sprints", 2);
      canvas.executionPlan.sprints.forEach((sprint, idx) => {
        addHeading(`Sprint ${idx + 1}: ${sprint.name}`, 3);
        addParagraph(`Goal: ${sprint.goal}`);
        addParagraph(`Duration: ${sprint.startDate} - ${sprint.endDate}`);
        addParagraph(`Capacity: ${sprint.capacity}${sprint.velocity ? ` | Velocity: ${sprint.velocity}` : ""}`);
        if (sprint.stories && sprint.stories.length > 0) {
          addParagraph(`Stories: ${sprint.stories.length}`);
        }
        y += 5;
      });
      addSeparator();
    }

    if (canvas.executionPlan.resources && canvas.executionPlan.resources.length > 0) {
      addHeading("Resources", 2);
      canvas.executionPlan.resources.forEach(resource => {
        addHeading(`${resource.name} (${resource.type})`, 3);
        addParagraph(resource.description);
        addParagraph(`Allocation: ${resource.allocation}`);
        if (resource.cost) addParagraph(`Cost: ${resource.cost}`);
        if (resource.timeline) addParagraph(`Timeline: ${resource.timeline}`);
        y += 5;
      });
    }
  }

  // Add footer with page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Page ${i} of ${pageCount} | ${title}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Generate Word document from Canvas
 */
async function generateDocx(
  canvas: ExtendedCanvas,
  title: string,
  sections: IncludeSections
): Promise<Buffer> {
  const {
    Document,
    Paragraph,
    TextRun,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    Packer,
    PageBreak,
  } = await import("docx");

  const children: (typeof Paragraph.prototype | typeof Table.prototype)[] = [];

  // Helper to create heading
  const addHeading = (text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel]): void => {
    children.push(
      new Paragraph({
        text,
        heading: level,
        spacing: { before: 200, after: 100 },
      })
    );
  };

  // Helper to create paragraph
  const addParagraph = (text: string): void => {
    children.push(
      new Paragraph({
        children: [new TextRun({ text })],
        spacing: { after: 100 },
      })
    );
  };

  // Helper to create bullet point
  const addBullet = (text: string): void => {
    children.push(
      new Paragraph({
        children: [new TextRun({ text })],
        bullet: { level: 0 },
        spacing: { after: 50 },
      })
    );
  };

  // Helper to add page break
  const addPageBreak = (): void => {
    children.push(
      new Paragraph({
        children: [new PageBreak()],
      })
    );
  };

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 48,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  // Subtitle
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Business Canvas Document",
          size: 28,
          color: "666666",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Document Info Table
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Status", bold: true })] })],
              width: { size: 30, type: WidthType.PERCENTAGE },
              shading: { fill: "F3F4F6" },
            }),
            new TableCell({
              children: [new Paragraph({ text: canvas.status.toUpperCase() })],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Generated", bold: true })] })],
              shading: { fill: "F3F4F6" },
            }),
            new TableCell({
              children: [new Paragraph({ text: new Date().toLocaleDateString("en-GB") })],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Created", bold: true })] })],
              shading: { fill: "F3F4F6" },
            }),
            new TableCell({
              children: [new Paragraph({ text: new Date(canvas.createdAt).toLocaleDateString("en-GB") })],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Last Updated", bold: true })] })],
              shading: { fill: "F3F4F6" },
            }),
            new TableCell({
              children: [new Paragraph({ text: new Date(canvas.updatedAt).toLocaleDateString("en-GB") })],
            }),
          ],
        }),
      ],
    })
  );

  children.push(new Paragraph({ text: "" }));

  // Canvas Fields Section
  if (sections.canvas) {
    addPageBreak();

    // Problem Statement
    const problemStatement = getFieldValue(canvas.problemStatement);
    if (problemStatement) {
      addHeading("Problem Statement", HeadingLevel.HEADING_1);
      addParagraph(problemStatement);
      const problemEvidence = canvas.problemStatement?.evidence;
      if (problemEvidence && problemEvidence.length > 0) {
        addHeading("Supporting Evidence", HeadingLevel.HEADING_3);
        problemEvidence.forEach(e => addBullet(`${e.snippet} (${e.source})`));
      }
    }

    // Objectives
    const objectives = formatArrayValue(getFieldValue(canvas.objectives));
    if (objectives.length > 0) {
      addHeading("Objectives", HeadingLevel.HEADING_1);
      objectives.forEach(obj => addBullet(obj));
    }

    // KPIs
    const kpis = formatArrayValue(getFieldValue(canvas.kpis));
    if (kpis.length > 0) {
      addHeading("Key Performance Indicators (KPIs)", HeadingLevel.HEADING_1);
      kpis.forEach(kpi => addBullet(kpi));
    }

    // Urgency
    const urgency = getFieldValue(canvas.urgency);
    if (urgency) {
      addHeading("Urgency Level", HeadingLevel.HEADING_2);
      addParagraph(String(urgency).toUpperCase());
    }

    // Key Features
    const keyFeatures = formatArrayValue(getFieldValue(canvas.keyFeatures));
    if (keyFeatures.length > 0) {
      addHeading("Key Features", HeadingLevel.HEADING_1);
      keyFeatures.forEach(feature => addBullet(feature));
    }

    // Dependencies
    const dependencies = formatArrayValue(getFieldValue(canvas.dependencies));
    if (dependencies.length > 0) {
      addHeading("Dependencies", HeadingLevel.HEADING_1);
      dependencies.forEach(dep => addBullet(dep));
    }

    // Data Dependencies
    const dataDependencies = formatArrayValue(getFieldValue(canvas.dataDependencies));
    if (dataDependencies.length > 0) {
      addHeading("Data Dependencies", HeadingLevel.HEADING_1);
      dataDependencies.forEach(dep => addBullet(dep));
    }

    // Risks
    const risks = formatArrayValue(getFieldValue(canvas.risks));
    if (risks.length > 0) {
      addHeading("Risks", HeadingLevel.HEADING_1);
      risks.forEach(risk => addBullet(risk));
    }

    // Assumptions
    const assumptions = formatArrayValue(getFieldValue(canvas.assumptions));
    if (assumptions.length > 0) {
      addHeading("Assumptions", HeadingLevel.HEADING_1);
      assumptions.forEach(assumption => addBullet(assumption));
    }

    // Technical Architecture
    const techArch = getFieldValue(canvas.technicalArchitecture);
    if (techArch) {
      addHeading("Technical Architecture", HeadingLevel.HEADING_1);
      if (Array.isArray(techArch)) {
        techArch.forEach((item) => {
          if (typeof item === "object" && item !== null) {
            const component = item as Record<string, unknown>;
            if (component.layer) {
              addHeading(String(component.layer), HeadingLevel.HEADING_3);
            }
            if (component.components && Array.isArray(component.components)) {
              (component.components as string[]).forEach(c => addBullet(c));
            }
            if (component.description) {
              addParagraph(String(component.description));
            }
          } else if (typeof item === "string") {
            addBullet(item);
          }
        });
      } else if (typeof techArch === "string") {
        addParagraph(techArch);
      }
    }

    // Security & Compliance
    const security = formatArrayValue(getFieldValue(canvas.securityCompliance));
    if (security.length > 0) {
      addHeading("Security & Compliance", HeadingLevel.HEADING_1);
      security.forEach(item => addBullet(item));
    }

    // Stakeholders
    const stakeholders = getFieldValue(canvas.stakeholderMap);
    if (stakeholders && Array.isArray(stakeholders) && stakeholders.length > 0) {
      addHeading("Stakeholder Map", HeadingLevel.HEADING_1);
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Name", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Role", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Influence", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Interest", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
              ],
            }),
            ...stakeholders
              .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
              .map((s) =>
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: String(s.name || "") })] }),
                    new TableCell({ children: [new Paragraph({ text: String(s.role || "") })] }),
                    new TableCell({ children: [new Paragraph({ text: String(s.influence || "") })] }),
                    new TableCell({ children: [new Paragraph({ text: String(s.interest || "") })] }),
                  ],
                })
            ),
          ],
        })
      );
    }

    // Budget & Resources
    const budget = getFieldValue(canvas.budgetResources);
    if (budget && typeof budget === "object") {
      addHeading("Budget & Resources", HeadingLevel.HEADING_1);
      const b = budget as Record<string, unknown>;
      if (b.totalEstimate) addParagraph(`Total Estimate: ${b.totalEstimate}`);
      if (b.fteRequirements) addParagraph(`FTE Requirements: ${b.fteRequirements}`);
      if (b.breakdown && Array.isArray(b.breakdown)) {
        addHeading("Breakdown", HeadingLevel.HEADING_3);
        (b.breakdown as Array<{ category: string; amount: string; notes?: string }>).forEach(item => {
          addBullet(`${item.category}: ${item.amount}${item.notes ? ` - ${item.notes}` : ""}`);
        });
      }
    }

    // ROI Analysis
    const roi = getFieldValue(canvas.roiAnalysis);
    if (roi && typeof roi === "object") {
      addHeading("ROI Analysis", HeadingLevel.HEADING_1);
      const r = roi as Record<string, unknown>;
      if (r.expectedReturn) addParagraph(`Expected Return: ${r.expectedReturn}`);
      if (r.paybackPeriod) addParagraph(`Payback Period: ${r.paybackPeriod}`);
      if (r.costBenefit) addParagraph(`Cost/Benefit: ${r.costBenefit}`);
      if (r.financialJustification) addParagraph(`Financial Justification: ${r.financialJustification}`);
    }

    // Timelines
    const timelines = getFieldValue(canvas.timelines);
    if (timelines && typeof timelines === "object") {
      addHeading("Timelines", HeadingLevel.HEADING_1);
      const t = timelines as Record<string, unknown>;
      if (t.start) addParagraph(`Start: ${t.start}`);
      if (t.end) addParagraph(`End: ${t.end}`);
      if (t.milestones && Array.isArray(t.milestones)) {
        addHeading("Milestones", HeadingLevel.HEADING_3);
        (t.milestones as Array<{ name: string; date?: string; description?: string }>).forEach(m => {
          addBullet(`${m.name}${m.date ? ` (${m.date})` : ""}${m.description ? ` - ${m.description}` : ""}`);
        });
      }
    }

    // Solution Recommendation
    const solution = canvas.solutionRecommendation;
    if (solution) {
      addHeading("Solution Recommendation", HeadingLevel.HEADING_1);
      if (solution.value) {
        if (typeof solution.value === "string") {
          addParagraph(solution.value);
        } else if (typeof solution.value === "object") {
          addParagraph(JSON.stringify(solution.value, null, 2));
        }
      }
      if (solution.actions && solution.actions.length > 0) {
        addHeading("Recommended Actions", HeadingLevel.HEADING_3);
        solution.actions.forEach(action => {
          if (typeof action === "string") {
            addBullet(action);
          } else if (typeof action === "object" && action !== null) {
            const a = action as { action?: string; priority?: string; owner?: string };
            addBullet(`${a.action || ""}${a.priority ? ` [${a.priority}]` : ""}${a.owner ? ` - Owner: ${a.owner}` : ""}`);
          }
        });
      }
    }

    // Alignment with Long-term Strategy
    const alignment = getFieldValue(canvas.alignmentLongTerm);
    if (alignment) {
      addHeading("Strategic Alignment", HeadingLevel.HEADING_1);
      if (typeof alignment === "string") {
        addParagraph(alignment);
      } else {
        addParagraph(JSON.stringify(alignment, null, 2));
      }
    }
  }

  // Research Section
  if (sections.research && canvas.research) {
    addPageBreak();
    addHeading("Research Report", HeadingLevel.HEADING_1);
    addParagraph(`Generated: ${new Date(canvas.research.generatedAt).toLocaleDateString("en-GB")}`);

    const researchSections = [
      { key: "competitorAnalysis", defaultTitle: "Competitor Analysis" },
      { key: "internalApplications", defaultTitle: "Internal Applications" },
      { key: "industryBenchmarks", defaultTitle: "Industry Benchmarks" },
      { key: "estimatedImpact", defaultTitle: "Estimated Impact" },
      { key: "recommendations", defaultTitle: "Recommendations" },
      { key: "strategicImplications", defaultTitle: "Strategic Implications" },
    ];

    for (const section of researchSections) {
      const data = canvas.research[section.key as keyof typeof canvas.research];
      if (data && typeof data === "object" && "content" in data) {
        addHeading(data.title || section.defaultTitle, HeadingLevel.HEADING_2);
        addParagraph(data.content);
        if ("sources" in data && Array.isArray(data.sources) && data.sources.length > 0) {
          addHeading("Sources", HeadingLevel.HEADING_3);
          data.sources.forEach((s: { title: string; url: string }) => addBullet(`${s.title}: ${s.url}`));
        }
      }
    }
  }

  // Epics/Stories Section
  if (sections.epics && canvas.stories && canvas.stories.length > 0) {
    addPageBreak();
    addHeading("Epics & User Stories", HeadingLevel.HEADING_1);

    const epics = canvas.stories.filter(s => s.type === "epic");
    const features = canvas.stories.filter(s => s.type === "feature");
    const userStories = canvas.stories.filter(s => s.type === "user-story");
    const devStories = canvas.stories.filter(s => s.type === "dev-story");

    if (epics.length > 0) {
      addHeading("Epics", HeadingLevel.HEADING_2);
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Title", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Description", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Priority", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                  width: { size: 15, type: WidthType.PERCENTAGE },
                }),
              ],
            }),
            ...epics.map(
              (epic) =>
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: epic.title })] }),
                    new TableCell({ children: [new Paragraph({ text: epic.description })] }),
                    new TableCell({ children: [new Paragraph({ text: epic.priority || "-" })] }),
                  ],
                })
            ),
          ],
        })
      );
    }

    if (features.length > 0) {
      addHeading("Features", HeadingLevel.HEADING_2);
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Title", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Epic", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Description", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Priority", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                  width: { size: 12, type: WidthType.PERCENTAGE },
                }),
              ],
            }),
            ...features.map(
              (feature) =>
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: feature.title })] }),
                    new TableCell({ children: [new Paragraph({ text: feature.epic || "-" })] }),
                    new TableCell({ children: [new Paragraph({ text: feature.description })] }),
                    new TableCell({ children: [new Paragraph({ text: feature.priority || "-" })] }),
                  ],
                })
            ),
          ],
        })
      );
    }

    if (userStories.length > 0) {
      addHeading("User Stories", HeadingLevel.HEADING_2);
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Title", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Feature", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Description", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Points", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                  width: { size: 10, type: WidthType.PERCENTAGE },
                }),
              ],
            }),
            ...userStories.map(
              (story) =>
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: story.title })] }),
                    new TableCell({ children: [new Paragraph({ text: story.feature || "-" })] }),
                    new TableCell({ children: [new Paragraph({ text: story.description })] }),
                    new TableCell({ children: [new Paragraph({ text: story.storyPoints?.toString() || "-" })] }),
                  ],
                })
            ),
          ],
        })
      );
    }

    if (devStories.length > 0) {
      addHeading("Development Stories", HeadingLevel.HEADING_2);
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Title", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Feature", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Description", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Points", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                  width: { size: 10, type: WidthType.PERCENTAGE },
                }),
              ],
            }),
            ...devStories.map(
              (story) =>
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: story.title })] }),
                    new TableCell({ children: [new Paragraph({ text: story.feature || "-" })] }),
                    new TableCell({ children: [new Paragraph({ text: story.description })] }),
                    new TableCell({ children: [new Paragraph({ text: story.storyPoints?.toString() || "-" })] }),
                  ],
                })
            ),
          ],
        })
      );
    }
  }

  // Benchmarks Section
  if (sections.benchmarks && canvas.benchmarks && canvas.benchmarks.length > 0) {
    addPageBreak();
    addHeading("Industry Benchmarks", HeadingLevel.HEADING_1);

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "Metric", bold: true })] })],
                shading: { fill: "E5E7EB" },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "Your Value", bold: true })] })],
                shading: { fill: "E5E7EB" },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "Industry Avg", bold: true })] })],
                shading: { fill: "E5E7EB" },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "Top Performers", bold: true })] })],
                shading: { fill: "E5E7EB" },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "Assessment", bold: true })] })],
                shading: { fill: "E5E7EB" },
              }),
            ],
          }),
          ...canvas.benchmarks.map(
            (b) =>
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: b.metric })] }),
                  new TableCell({ children: [new Paragraph({ text: b.yourValue })] }),
                  new TableCell({ children: [new Paragraph({ text: b.industryAverage })] }),
                  new TableCell({ children: [new Paragraph({ text: b.topPerformers })] }),
                  new TableCell({ children: [new Paragraph({ text: b.assessment.toUpperCase() })] }),
                ],
              })
          ),
        ],
      })
    );

    // Add recommendations
    const withRecommendations = canvas.benchmarks.filter(b => b.recommendation);
    if (withRecommendations.length > 0) {
      addHeading("Recommendations", HeadingLevel.HEADING_2);
      withRecommendations.forEach(b => {
        addBullet(`${b.metric}: ${b.recommendation}`);
      });
    }
  }

  // Execution Plan Section
  if (sections.executionPlan && canvas.executionPlan) {
    addPageBreak();
    addHeading("Execution Plan", HeadingLevel.HEADING_1);

    if (canvas.executionPlan.sprints && canvas.executionPlan.sprints.length > 0) {
      addHeading("Sprints", HeadingLevel.HEADING_2);
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Sprint", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Goal", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Duration", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Capacity", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
              ],
            }),
            ...canvas.executionPlan.sprints.map(
              (sprint, idx) =>
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: `Sprint ${idx + 1}: ${sprint.name}` })] }),
                    new TableCell({ children: [new Paragraph({ text: sprint.goal })] }),
                    new TableCell({ children: [new Paragraph({ text: `${sprint.startDate} - ${sprint.endDate}` })] }),
                    new TableCell({ children: [new Paragraph({ text: sprint.capacity.toString() })] }),
                  ],
                })
            ),
          ],
        })
      );
    }

    if (canvas.executionPlan.resources && canvas.executionPlan.resources.length > 0) {
      addHeading("Resources", HeadingLevel.HEADING_2);
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Name", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Type", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Description", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Allocation", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Cost", bold: true })] })],
                  shading: { fill: "E5E7EB" },
                }),
              ],
            }),
            ...canvas.executionPlan.resources.map(
              (resource) =>
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: resource.name })] }),
                    new TableCell({ children: [new Paragraph({ text: resource.type })] }),
                    new TableCell({ children: [new Paragraph({ text: resource.description })] }),
                    new TableCell({ children: [new Paragraph({ text: resource.allocation })] }),
                    new TableCell({ children: [new Paragraph({ text: resource.cost || "-" })] }),
                  ],
                })
            ),
          ],
        })
      );
    }
  }

  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
