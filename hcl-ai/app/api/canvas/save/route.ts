import { NextRequest, NextResponse } from "next/server";
import { businessCanvasSchema } from "@/lib/validators/canvas-schema";
import { saveCanvas, getCanvasById, canUserAccessCanvas } from "@/services/database/canvas-repository";
import { nanoid } from "nanoid";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import { auth } from "@/lib/auth";

// Transform functions for complex array fields
// These convert strings/primitives to the expected object structure
// NOTE: With flexible schema, these transforms are now optional helpers -
// the schema accepts both strings AND objects, so we only transform when needed
const complexFieldTransformers: Record<string, (item: unknown) => unknown> = {
  successCriteria: (item) => {
    // Keep objects as-is (flexible schema supports any object structure)
    if (typeof item === 'object' && item !== null) return item;
    // Only transform strings if needed
    const str = String(item).trim();
    return { metric: str, target: '', measurement: '' };
  },
  stakeholderMap: (item) => {
    if (typeof item === 'object' && item !== null) return item;
    const str = String(item).trim();
    return { name: str, role: '', interest: 'medium', influence: 'medium' };
  },
  technicalArchitecture: (item) => {
    if (typeof item === 'object' && item !== null) return item;
    const str = String(item).trim();
    return { layer: 'Application', component: str, technology: '' };
  },
  okrs: (item) => {
    if (typeof item === 'object' && item !== null) return item;
    const str = String(item).trim();
    return { objective: str, keyResults: [] };
  },
};

/**
 * Ensure timeline has valid structure with defaults
 * Flexible schema allows partial timelines, but we ensure minimum structure
 */
function normalizeTimeline(timeline: unknown): unknown {
  if (!timeline || typeof timeline !== 'object') {
    return { start: null, end: null, milestones: [] };
  }
  
  const tl = timeline as Record<string, unknown>;
  return {
    start: tl.start ?? null,
    end: tl.end ?? null,
    milestones: Array.isArray(tl.milestones) ? tl.milestones : [],
    ...tl, // Preserve any additional properties from user config
  };
}

/**
 * Transform complex fields in a canvas object to ensure correct structure
 * With flexible schema, this is now mainly for backwards compatibility -
 * the schema accepts both strings and objects in arrays
 */
function transformComplexFields(canvas: Record<string, unknown>): Record<string, unknown> {
  const transformed = { ...canvas };

  // Transform complex array fields (only transforms strings to objects, preserves objects as-is)
  for (const fieldKey of Object.keys(complexFieldTransformers)) {
    const field = transformed[fieldKey];
    if (!field) continue;

    // Handle field with value property (standard canvas field structure)
    if (typeof field === 'object' && field !== null && 'value' in field) {
      const fieldObj = field as { value: unknown };
      if (Array.isArray(fieldObj.value)) {
        fieldObj.value = fieldObj.value.map(complexFieldTransformers[fieldKey]);
      }
    }
    // Handle direct array
    else if (Array.isArray(field)) {
      transformed[fieldKey] = field.map(complexFieldTransformers[fieldKey]);
    }
  }

  // Normalize timelines to ensure valid structure with defaults
  const timelinesField = transformed.timelines;
  if (timelinesField && typeof timelinesField === 'object' && timelinesField !== null) {
    if ('value' in timelinesField) {
      const fieldObj = timelinesField as { value: unknown };
      fieldObj.value = normalizeTimeline(fieldObj.value);
    }
  }

  return transformed;
}

/**
 * POST /api/canvas/save
 * Saves a canvas to the database
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Apply authentication and rate limiting
  const { response } = await applyApiMiddleware(
    request,
    MIDDLEWARE_PRESETS.AUTH
  );
  if (response) return response;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    let canvasToSave;

    // Check if this is a partial update request
    if (body.canvasId && body.updates) {
      // SECURITY: Verify user has access to this canvas before allowing updates
      const hasAccess = await canUserAccessCanvas(body.canvasId, session.user.id);
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Fetch existing canvas
      const existingCanvas = await getCanvasById(body.canvasId);
      if (!existingCanvas) {
        return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
      }

      // Apply updates
      const updatedCanvas = { ...existingCanvas };
      const updates = body.updates as Record<string, string>;
      
      // Known simple array fields that can be split by newline/comma into string arrays
      const knownSimpleArrayFields = new Set([
        'risks', 'objectives', 'kpis', 'keyFeatures', 'dependencies', 'dataDependencies',
        'assumptions', 'securityCompliance'
      ]);

      for (const [key, value] of Object.entries(updates)) {
        // Check if the key exists in the canvas schema
        if (key in updatedCanvas) {
          const fieldKey = key as keyof typeof updatedCanvas;
          const field = updatedCanvas[fieldKey];

          let parsedValue: unknown = value;

          // 1. Try generic JSON parse
          if (typeof value === 'string') {
            try {
              parsedValue = JSON.parse(value);
            } catch {
              // 2. Fallback: parsing failed

              // If it's a known simple array field, try splitting by newline or comma
              if (knownSimpleArrayFields.has(key)) {
                parsedValue = value
                  .split(/[\n,]+/) // Split by newline or comma
                  .map(s => s.trim()) // Trim whitespace
                  .filter(s => s.length > 0); // Remove empty strings
              } else if (key in complexFieldTransformers) {
                // Complex array field - split and transform each item
                const items = value
                  .split(/[\n]+/) // Split by newline for complex fields
                  .map(s => s.trim())
                  .filter(s => s.length > 0);
                parsedValue = items.map(complexFieldTransformers[key]);
              }
              // If parsing failed and not a known field, parsedValue remains the original string
            }
          }

          // 3. For complex fields, ensure array items are properly structured
          if (key in complexFieldTransformers && Array.isArray(parsedValue)) {
            parsedValue = parsedValue.map(complexFieldTransformers[key]);
          }

          // If the field is a complex object with a 'value' property (standard canvas field)
          if (field && typeof field === 'object' && 'value' in field) {
            // Using a temporary object to bypass strict type checking for the generic update
            const updatedField = { ...field, value: parsedValue };
            (updatedCanvas as Record<string, unknown>)[key] = updatedField;
          } else {
            // Direct property update
            (updatedCanvas as Record<string, unknown>)[key] = parsedValue;
          }
        } else {
          // Allow adding optional fields (e.g., newly generated research)
          (updatedCanvas as Record<string, unknown>)[key] = typeof value === 'string' ? value : structuredClone(value);
        }
      }
      
      updatedCanvas.updatedAt = new Date().toISOString();
      canvasToSave = updatedCanvas;
      
    } else {
      // Standard full save
      canvasToSave = body;
    }

    // Add ID if not present
    if (!canvasToSave.id) {
      canvasToSave.id = nanoid();
    }

    // Add timestamps if not present
    if (!canvasToSave.createdAt) {
      canvasToSave.createdAt = new Date().toISOString();
    }
    if (!canvasToSave.updatedAt) {
      canvasToSave.updatedAt = new Date().toISOString();
    }

    // Add status if not present
    if (!canvasToSave.status) {
      canvasToSave.status = "draft";
    }

    // Transform complex fields to ensure correct structure before validation
    canvasToSave = transformComplexFields(canvasToSave);

    // Validate canvas
    const validatedCanvas = businessCanvasSchema.parse(canvasToSave);

    // Debug: Log all fields in the canvas
    console.log(`📋 [SAVE] Canvas fields before save: ${Object.keys(validatedCanvas).length}`);

    // Check for custom fields (fields not in standard set)
    const standardFields = new Set([
      'id', 'title', 'problemStatement', 'objectives', 'kpis', 'urgency',
      'timelines', 'risks', 'keyFeatures', 'dependencies', 'dataDependencies',
      'alignmentLongTerm', 'solutionRecommendation', 'stakeholderMap',
      'budgetResources', 'successCriteria', 'assumptions', 'technicalArchitecture',
      'securityCompliance', 'changeManagement', 'roiAnalysis', 'createdAt',
      'updatedAt', 'status', 'research', 'uploadedFiles'
    ]);

    const customFieldsInCanvas = Object.keys(validatedCanvas).filter(key => !standardFields.has(key));
    if (customFieldsInCanvas.length > 0) {
    console.log(`🎯 [SAVE] Custom fields found in canvas: ${customFieldsInCanvas.length}`);
    }

    // Save to database with owner_id
    await saveCanvas(validatedCanvas, session.user.id, body.updates ? "Applied research updates" : undefined, session.user.id);

    return NextResponse.json(validatedCanvas);
  } catch (error) {
    console.error("Error saving canvas:", error);

    if (error instanceof Error) {
      // Zod validation errors often contain detailed info
      if (error.constructor.name === "ZodError") {
         console.error("Validation details:", JSON.stringify((error as unknown as { issues: unknown[] }).issues, null, 2));
      }
      
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to save canvas" },
      { status: 500 }
    );
  }
}
