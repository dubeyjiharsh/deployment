import { NextRequest, NextResponse } from "next/server";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import { auth } from "@/lib/auth";
import { getCanvasById } from "@/services/database/canvas-repository";
import { z } from "zod";
import type { BusinessCanvas } from "@/lib/validators/canvas-schema";
import type { BRDDocument } from "@/lib/validators/brd-schema";
import { userRepository } from "@/services/database/user-repository";

// Extended canvas type with BRD
type ExtendedCanvas = BusinessCanvas & {
  brd?: BRDDocument;
};

const requestSchema = z.object({
  canvasId: z.string(),
  format: z.enum(["pdf", "docx"]),
});

/**
 * POST /api/canvas/export-brd
 * Exports BRD as PDF or Word document
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log("🚀 Starting BRD Export");

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

    console.log("🎯 Export BRD - Canvas ID:", validated.canvasId, "Format:", validated.format);

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

    if (!canvas.brd) {
      return NextResponse.json(
        { error: "No BRD exists for this canvas. Generate one first." },
        { status: 400 }
      );
    }

    console.log("✅ Canvas and BRD loaded successfully");

    const brd = canvas.brd;

    if (validated.format === "pdf") {
      // Generate PDF using jspdf
      const pdfBuffer = await generatePDF(brd);

      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${brd.metadata.programName.replace(/\s+/g, "_")}_BRD.pdf"`,
        },
      });
    } else {
      // Generate Word document using docx library
      const docxBuffer = await generateDocx(brd);

      return new NextResponse(new Uint8Array(docxBuffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${brd.metadata.programName.replace(/\s+/g, "_")}_BRD.docx"`,
        },
      });
    }
  } catch (error) {
    console.error("❌ Error exporting BRD:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to export BRD" }, { status: 500 });
  }
}

/**
 * Generate PDF from BRD
 */
async function generatePDF(brd: BRDDocument): Promise<Buffer> {
  // Use jsPDF for server-side PDF generation
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

    // Check if we need a new page
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

  // Title
  addHeading(`${brd.metadata.programName} | BRD`, 1);

  // Document info
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`BRD Owner: ${brd.metadata.brdOwner}`, margin, y);
  y += 5;
  doc.text(`Portfolio Epic: ${brd.metadata.portfolioEpic || "N/A"}`, margin, y);
  y += 5;
  doc.text(`Version: ${brd.metadata.version || "1.0"}`, margin, y);
  y += 5;
  doc.text(`Generated: ${new Date(brd.generatedAt).toLocaleDateString("en-GB")}`, margin, y);
  y += 10;

  addSeparator();

  // Executive Summary
  addHeading("Executive Summary", 1);
  addParagraph(brd.executiveSummary.content);

  addSeparator();

  // Objective
  addHeading("Objective", 1);
  addHeading("Business Goal", 2);
  addParagraph(brd.objective.businessGoal);

  addHeading("What", 3);
  addParagraph(brd.objective.what);

  addHeading("Why", 3);
  addParagraph(brd.objective.why);

  addHeading("Impact", 3);
  addParagraph(brd.objective.impact);

  addSeparator();

  // Success Criteria
  addHeading("Success Criteria", 1);
  for (const criteria of brd.successCriteria) {
    addHeading(criteria.objective, 3);
    for (const kr of criteria.keyResults) {
      addListItem(kr);
    }
  }

  addSeparator();

  // Use Cases
  addHeading("Use Cases", 1);
  for (const useCase of brd.useCases) {
    addListItem(`[${useCase.priority}] ${useCase.description}`);
  }

  addSeparator();

  // Scope
  addHeading("Scope", 1);

  addHeading("In Scope", 2);
  for (const item of brd.scope.filter((s) => s.category === "in_scope")) {
    addListItem(item.description);
  }

  addHeading("Out of Scope", 2);
  for (const item of brd.scope.filter((s) => s.category === "out_of_scope")) {
    addListItem(item.description);
  }

  const undecided = brd.scope.filter((s) => s.category === "undecided");
  if (undecided.length > 0) {
    addHeading("Undecided", 2);
    for (const item of undecided) {
      addListItem(item.description);
    }
  }

  addSeparator();

  // Non-Functional Requirements
  addHeading("Non-Functional Requirements", 1);
  for (const nfr of brd.nonFunctionalRequirements) {
    addHeading(`[${nfr.priority}] ${nfr.category}`, 3);
    addParagraph(`Requirement: ${nfr.requirement}`);
    addParagraph(`Acceptance Criteria: ${nfr.acceptanceCriteria}`);
    y += 3;
  }

  addSeparator();

  // Assumptions & Constraints
  addHeading("Assumptions", 1);
  for (const assumption of brd.assumptions) {
    addListItem(assumption);
  }

  addHeading("Constraints", 1);
  for (const constraint of brd.constraints) {
    addListItem(constraint);
  }

  addSeparator();

  // Risks
  addHeading("Risks and Mitigations", 1);
  for (const risk of brd.risks) {
    addHeading(risk.risk, 3);
    addParagraph(`Mitigation: ${risk.mitigation}`);
  }

  addSeparator();

  // Features
  addHeading("Features", 1);
  for (const feature of brd.features) {
    addHeading(`[${feature.priority}] ${feature.name}`, 2);
    addParagraph(feature.description);
    addParagraph(`Business Requirements: ${feature.businessRequirements}`);
    if (feature.dataRequirements) {
      addParagraph(`Data Requirements: ${feature.dataRequirements}`);
    }
    addParagraph(`Acceptance Criteria: ${feature.acceptanceCriteria}`);
    y += 5;
  }

  // Governance (if present)
  if (brd.metadata.signOffApprovers?.length || brd.metadata.reviewers?.length) {
    addSeparator();
    addHeading("Governance", 1);

    if (brd.metadata.signOffApprovers?.length) {
      addHeading("Sign-off Approvers", 2);
      for (const approver of brd.metadata.signOffApprovers) {
        addListItem(`${approver.role}: ${approver.name || "Not provided"}`);
      }
    }

    if (brd.metadata.reviewers?.length) {
      addHeading("Reviewers", 2);
      for (const reviewer of brd.metadata.reviewers) {
        addListItem(`${reviewer.role}: ${reviewer.name || "Not provided"} ${reviewer.function ? `(${reviewer.function})` : ""}`);
      }
    }
  }

  // Glossary (if present)
  if (brd.metadata.glossaryTerms?.length) {
    addSeparator();
    addHeading("Appendix - Glossary", 1);
    for (const term of brd.metadata.glossaryTerms) {
      addHeading(term.term, 3);
      addParagraph(term.definition);
    }
  }

  // Add footer with page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Generate Word document from BRD
 */
async function generateDocx(brd: BRDDocument): Promise<Buffer> {
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
  } = await import("docx");

  // Create section children
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

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${brd.metadata.programName} | BRD`,
          bold: true,
          size: 48,
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
              children: [new Paragraph({ children: [new TextRun({ text: "Program", bold: true })] })],
              width: { size: 30, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph({ text: brd.metadata.programName })],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Portfolio Epic", bold: true })] })],
            }),
            new TableCell({
              children: [new Paragraph({ text: brd.metadata.portfolioEpic || "N/A" })],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "BRD Owner", bold: true })] })],
            }),
            new TableCell({
              children: [new Paragraph({ text: brd.metadata.brdOwner })],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "BRD Approver", bold: true })] })],
            }),
            new TableCell({
              children: [new Paragraph({ text: brd.metadata.brdApprover || "Not provided" })],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Version", bold: true })] })],
            }),
            new TableCell({
              children: [new Paragraph({ text: brd.metadata.version || "1.0" })],
            }),
          ],
        }),
      ],
    })
  );

  children.push(new Paragraph({ text: "" })); // Spacer

  // Executive Summary
  addHeading("Executive Summary", HeadingLevel.HEADING_1);
  addParagraph(brd.executiveSummary.content);

  // Objective
  addHeading("Objective", HeadingLevel.HEADING_1);
  addHeading("Business Goal", HeadingLevel.HEADING_2);
  addParagraph(brd.objective.businessGoal);

  addHeading("What", HeadingLevel.HEADING_3);
  addParagraph(brd.objective.what);

  addHeading("Why", HeadingLevel.HEADING_3);
  addParagraph(brd.objective.why);

  addHeading("Impact", HeadingLevel.HEADING_3);
  addParagraph(brd.objective.impact);

  // Success Criteria
  addHeading("Success Criteria", HeadingLevel.HEADING_1);
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Objective", bold: true })] })],
              shading: { fill: "E6E6FA" },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Key Results", bold: true })] })],
              shading: { fill: "E6E6FA" },
            }),
          ],
        }),
        ...brd.successCriteria.map(
          (criteria) =>
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: criteria.objective })],
                }),
                new TableCell({
                  children: criteria.keyResults.map(
                    (kr) =>
                      new Paragraph({
                        children: [new TextRun({ text: `• ${kr}` })],
                      })
                  ),
                }),
              ],
            })
        ),
      ],
    })
  );

  // Use Cases
  addHeading("Use Cases", HeadingLevel.HEADING_1);
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Use Case", bold: true })] })],
              shading: { fill: "E6E6FA" },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Priority", bold: true })] })],
              shading: { fill: "E6E6FA" },
              width: { size: 15, type: WidthType.PERCENTAGE },
            }),
          ],
        }),
        ...brd.useCases.map(
          (uc) =>
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: uc.description })],
                }),
                new TableCell({
                  children: [new Paragraph({ text: uc.priority })],
                }),
              ],
            })
        ),
      ],
    })
  );

  // Scope
  addHeading("Scope", HeadingLevel.HEADING_1);
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "In Scope", bold: true })] })],
              shading: { fill: "E6E6FA" },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Out of Scope", bold: true })] })],
              shading: { fill: "E6E6FA" },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Undecided", bold: true })] })],
              shading: { fill: "E6E6FA" },
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: brd.scope
                .filter((s) => s.category === "in_scope")
                .map((s) => new Paragraph({ children: [new TextRun({ text: `• ${s.description}` })] })),
            }),
            new TableCell({
              children: brd.scope
                .filter((s) => s.category === "out_of_scope")
                .map((s) => new Paragraph({ children: [new TextRun({ text: `• ${s.description}` })] })),
            }),
            new TableCell({
              children: brd.scope
                .filter((s) => s.category === "undecided")
                .map((s) => new Paragraph({ children: [new TextRun({ text: `• ${s.description}` })] })),
            }),
          ],
        }),
      ],
    })
  );

  // Non-Functional Requirements
  addHeading("Non-Functional Requirements", HeadingLevel.HEADING_1);
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Category", bold: true })] })],
              shading: { fill: "E6E6FA" },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Requirement", bold: true })] })],
              shading: { fill: "E6E6FA" },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Acceptance Criteria", bold: true })] })],
              shading: { fill: "E6E6FA" },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Priority", bold: true })] })],
              shading: { fill: "E6E6FA" },
              width: { size: 10, type: WidthType.PERCENTAGE },
            }),
          ],
        }),
        ...brd.nonFunctionalRequirements.map(
          (nfr) =>
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: nfr.category })],
                }),
                new TableCell({
                  children: [new Paragraph({ text: nfr.requirement })],
                }),
                new TableCell({
                  children: [new Paragraph({ text: nfr.acceptanceCriteria })],
                }),
                new TableCell({
                  children: [new Paragraph({ text: nfr.priority })],
                }),
              ],
            })
        ),
      ],
    })
  );

  // Assumptions and Constraints
  addHeading("Assumptions and Constraints", HeadingLevel.HEADING_1);
  addHeading("Assumptions", HeadingLevel.HEADING_2);
  for (const assumption of brd.assumptions) {
    addBullet(assumption);
  }
  addHeading("Constraints", HeadingLevel.HEADING_2);
  for (const constraint of brd.constraints) {
    addBullet(constraint);
  }

  // Risks and Mitigations
  addHeading("Risks and Mitigations", HeadingLevel.HEADING_1);
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Risk", bold: true })] })],
              shading: { fill: "E6E6FA" },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Mitigation", bold: true })] })],
              shading: { fill: "E6E6FA" },
            }),
          ],
        }),
        ...brd.risks.map(
          (risk) =>
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: risk.risk })],
                }),
                new TableCell({
                  children: [new Paragraph({ text: risk.mitigation })],
                }),
              ],
            })
        ),
      ],
    })
  );

  // Features
  addHeading("Features", HeadingLevel.HEADING_1);
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Feature Name", bold: true })] })],
              shading: { fill: "E6E6FA" },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Description", bold: true })] })],
              shading: { fill: "E6E6FA" },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Business Requirements", bold: true })] })],
              shading: { fill: "E6E6FA" },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Acceptance Criteria", bold: true })] })],
              shading: { fill: "E6E6FA" },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Priority", bold: true })] })],
              shading: { fill: "E6E6FA" },
              width: { size: 8, type: WidthType.PERCENTAGE },
            }),
          ],
        }),
        ...brd.features.map(
          (feature) =>
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: feature.name })],
                }),
                new TableCell({
                  children: [new Paragraph({ text: feature.description })],
                }),
                new TableCell({
                  children: [new Paragraph({ text: feature.businessRequirements })],
                }),
                new TableCell({
                  children: [new Paragraph({ text: feature.acceptanceCriteria })],
                }),
                new TableCell({
                  children: [new Paragraph({ text: feature.priority })],
                }),
              ],
            })
        ),
      ],
    })
  );

  // Governance
  if (brd.metadata.signOffApprovers?.length || brd.metadata.reviewers?.length) {
    addHeading("Governance", HeadingLevel.HEADING_1);

    if (brd.metadata.signOffApprovers?.length) {
      addHeading("Sign-off Approvers", HeadingLevel.HEADING_2);
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Role", bold: true })] })],
                  shading: { fill: "E6E6FA" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Name", bold: true })] })],
                  shading: { fill: "E6E6FA" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Function", bold: true })] })],
                  shading: { fill: "E6E6FA" },
                }),
              ],
            }),
            ...brd.metadata.signOffApprovers.map(
              (approver) =>
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ text: approver.role })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: approver.name || "-" })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: approver.function || "-" })],
                    }),
                  ],
                })
            ),
          ],
        })
      );
    }

    if (brd.metadata.reviewers?.length) {
      addHeading("Reviewers", HeadingLevel.HEADING_2);
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Role", bold: true })] })],
                  shading: { fill: "E6E6FA" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Name", bold: true })] })],
                  shading: { fill: "E6E6FA" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Function", bold: true })] })],
                  shading: { fill: "E6E6FA" },
                }),
              ],
            }),
            ...brd.metadata.reviewers.map(
              (reviewer) =>
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ text: reviewer.role })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: reviewer.name || "-" })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: reviewer.function || "-" })],
                    }),
                  ],
                })
            ),
          ],
        })
      );
    }
  }

  // Glossary
  if (brd.metadata.glossaryTerms?.length) {
    addHeading("Appendix - Glossary", HeadingLevel.HEADING_1);
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "Term", bold: true })] })],
                shading: { fill: "E6E6FA" },
                width: { size: 30, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: "Definition", bold: true })] })],
                shading: { fill: "E6E6FA" },
              }),
            ],
          }),
          ...brd.metadata.glossaryTerms.map(
            (term) =>
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ text: term.term })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: term.definition })],
                  }),
                ],
              })
          ),
        ],
      })
    );
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
