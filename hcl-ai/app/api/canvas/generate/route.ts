import { NextRequest, NextResponse } from "next/server";
import { canvasGenerationRequestSchema } from "@/lib/validators/canvas-schema";
import { generateCanvas } from "@/services/llm/llm-client";
import { saveCanvas } from "@/services/database/canvas-repository";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import { auth } from "@/lib/auth";
import { userRepository } from "@/services/database/user-repository";

/**
 * POST /api/canvas/generate
 * Generates a new business canvas from user input
 * MCP tools are now called directly by the LLM as needed
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Apply authentication and rate limiting
  const { response } = await applyApiMiddleware(
    request,
    MIDDLEWARE_PRESETS.AI
  );
  if (response) return response;

  try {
    const body = await request.json();

    // Validate request
    const validatedRequest = canvasGenerationRequestSchema.parse(body);

    // Get user's team and custom fields
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Import settings repository and DEFAULT_CANVAS_FIELDS
    const { settingsRepository } = await import("@/services/database/settings-repository");
    const { DEFAULT_CANVAS_FIELDS } = await import("@/lib/constants/default-canvas-fields");

    // Fetch global field configuration
    const settings = await settingsRepository.getSettings();
    const storedFields = settings?.canvasFields;

    // Merge stored fields with defaults to ensure new properties (like displayStyle) have values
    type FieldConfig = typeof DEFAULT_CANVAS_FIELDS[number];
    let globalFields: FieldConfig[];
    if (storedFields && storedFields.length > 0) {
      const defaultsMap = new Map(DEFAULT_CANVAS_FIELDS.map(f => [f.fieldKey, f]));
      globalFields = storedFields.map((storedField: FieldConfig) => {
        const defaultField = defaultsMap.get(storedField.fieldKey);
        if (defaultField) {
          return {
            ...defaultField,
            ...storedField,
            displayStyle: storedField.displayStyle || defaultField.displayStyle || "auto",
          };
        }
        return {
          ...storedField,
          displayStyle: storedField.displayStyle || "auto",
        };
      });
    } else {
      globalFields = DEFAULT_CANVAS_FIELDS;
    }
    console.log(`🌐 Loaded ${globalFields.length} global fields (${globalFields.filter(f => f.enabled).length} enabled)`);

    // Get team custom fields
    let teamCustomFields: Array<{ id: string; name: string; instructions: string; enabled: boolean; valueType?: string; displayStyle?: string }> = [];

    const user = await userRepository.getUserById(session.user.id);
    console.log(`🔍 User context loaded (teamId=${user?.teamId || "none"})`);

    if (user?.teamId) {
      const team = await userRepository.getTeamById(user.teamId);
      console.log(`👥 Team found: ${team?.name}, Custom fields: ${team?.customFields?.length || 0}`);

      if (team?.customFields) {
        // Filter for enabled custom fields only
        teamCustomFields = team.customFields.filter((f: { enabled: boolean }) => f.enabled);
        console.log(`✅ Team custom fields: ${teamCustomFields.length}`);
      }
    } else {
      console.log(`❌ User has no team ID`);
    }

    // Merge global fields + team custom fields
    const allFields = [
      ...globalFields,
      ...teamCustomFields.map((tcf) => ({
        id: tcf.id,
        name: tcf.name,
        fieldKey: tcf.name
          .replace(/[^a-zA-Z0-9\s]/g, "")
          .split(/\s+/)
          .map((word, index) =>
            index === 0
              ? word.toLowerCase()
              : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          )
          .join(""),
        instructions: tcf.instructions,
        enabled: tcf.enabled,
        type: 'custom' as const,
        valueType: tcf.valueType || 'string',
        displayStyle: tcf.displayStyle || 'auto',
        supportsDiagram: false,
      }))
    ];

    console.log(`📋 Total fields for generation: ${allFields.length} (${allFields.filter(f => f.enabled).length} enabled)`);


    // Retrieve uploaded file contents if any
    const fileContents: Array<{ filename: string; content: string }> = [];
    if (validatedRequest.uploadedFiles && validatedRequest.uploadedFiles.length > 0) {
      const { settingsRepository } = await import("@/services/database/settings-repository");

      for (const fileId of validatedRequest.uploadedFiles) {
        const document = await settingsRepository.getDocumentById(fileId);
        if (document) {
          fileContents.push({
            filename: document.filename,
            content: document.content,
          });
        console.log(`📄 Loaded file: ${document.filename} (length=${document.content.length})`);
        }
      }

      if (fileContents.length > 0) {
        console.log(`✅ Loaded ${fileContents.length} file(s) for canvas generation`);
      }
    }

    // Generate canvas using LLM with MCP tool calling
    // The LLM will decide which MCP tools to call and when
    const canvas = await generateCanvas(
      validatedRequest.problemStatement,
      validatedRequest.contextualInfo,
      allFields,
      fileContents
    );

    // Debug: Log all fields in the generated canvas
    console.log(`📋 Generated canvas fields count: ${Object.keys(canvas).length}`);

    // Check for custom fields (fields not in standard set)
    const standardFields = new Set([
      'id', 'title', 'problemStatement', 'objectives', 'kpis', 'urgency',
      'timelines', 'risks', 'keyFeatures', 'dependencies', 'dataDependencies',
      'alignmentLongTerm', 'solutionRecommendation', 'stakeholderMap',
      'budgetResources', 'successCriteria', 'assumptions', 'technicalArchitecture',
      'securityCompliance', 'changeManagement', 'roiAnalysis', 'createdAt',
      'updatedAt', 'status'
    ]);

    const customFieldsInCanvas = Object.keys(canvas).filter(key => !standardFields.has(key));
    if (customFieldsInCanvas.length > 0) {
    console.log(`🎯 Custom fields found in canvas: ${customFieldsInCanvas.length}`);
  } else {
    console.log(`⚠️ No custom fields found in canvas`);
  }

    // Save to database with owner_id
    await saveCanvas(canvas, session.user.id, undefined, session.user.id);

    return NextResponse.json(canvas);
  } catch (error) {
    console.error("Error generating canvas:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate canvas" },
      { status: 500 }
    );
  }
}
