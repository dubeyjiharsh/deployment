import { NextRequest, NextResponse } from "next/server";
import { settingsRepository } from "@/services/database/settings-repository";
import { userRepository } from "@/services/database/user-repository";
import { auth } from "@/lib/auth";
import { DEFAULT_CANVAS_FIELDS } from "@/lib/constants/default-canvas-fields";
import type { FieldConfiguration, FieldAccessLevel } from "@/lib/validators/settings-schema";

/**
 * GET /api/settings/fields
 * Returns field configuration (global + team custom fields) for authenticated users
 * Unlike /api/settings, this is accessible to all users, not just admins
 */
export async function GET(_req: NextRequest) {
  try {
    // Authentication required
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch global field configuration and availability from settings
    const settings = await settingsRepository.getSettings();
    const storedFields = settings?.canvasFields;
    const normalizeAccessValue = (value: unknown): FieldAccessLevel => {
      if (value === "hidden" || value === "read" || value === "edit") return value;
      // Treat legacy/invalid values (including "required") as editable
      return "edit";
    };

    // Merge stored fields with defaults to ensure new properties (like displayStyle) have values
    // This handles the case where fields were saved before new properties were added
    let globalFields: FieldConfiguration[];
    if (storedFields && storedFields.length > 0) {
      // Create a map of defaults by fieldKey for quick lookup
      const defaultsMap = new Map(DEFAULT_CANVAS_FIELDS.map(f => [f.fieldKey, f]));

      globalFields = storedFields.map((storedField: FieldConfiguration) => {
        const defaultField = defaultsMap.get(storedField.fieldKey);
        if (defaultField) {
          // Merge: stored values take precedence, but fill in missing properties from defaults
          return {
            ...defaultField, // Start with defaults (includes displayStyle)
            ...storedField,  // Override with stored values
            // Ensure displayStyle has a value (fallback to default or "auto")
            displayStyle: storedField.displayStyle || defaultField.displayStyle || "auto",
          };
        }
        // Custom field not in defaults - ensure displayStyle has a value
        return {
          ...storedField,
          displayStyle: storedField.displayStyle || "auto",
        };
      });
    } else {
      globalFields = DEFAULT_CANVAS_FIELDS;
    }

    // Get team custom fields if user has a team
    let teamCustomFields: Array<{
      id: string;
      name: string;
      fieldKey: string;
      type: string;
      category: string;
      enabled: boolean;
      includeInGeneration: boolean;
      order: number;
      valueType: string;
      instructions: string;
      supportsDiagram: boolean;
      isRequired: boolean;
      displayStyle: string;
    }> = [];
    const user = await userRepository.getUserById(session.user.id);

    if (user?.teamId) {
      const team = await userRepository.getTeamById(user.teamId);
      if (team?.customFields) {
        // Filter for enabled custom fields only
        teamCustomFields = team.customFields
          .filter((f: { enabled: boolean }) => f.enabled)
          .map((tcf: { id: string; name: string; enabled: boolean; displayStyle?: string }, index: number) => ({
            id: tcf.id,
            name: tcf.name,
            fieldKey: tcf.name
              .replace(/[^a-zA-Z0-9\s]/g, "")
              .split(/\s+/)
              .map((word: string, i: number) =>
                i === 0
                  ? word.toLowerCase()
                  : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
              )
              .join(""),
            type: "custom",
            category: "custom",
            enabled: tcf.enabled,
            includeInGeneration: true, // Team fields are always included in generation
            order: globalFields.length + index,
            valueType: "string",
            instructions: "",
            supportsDiagram: false,
            isRequired: false,
            displayStyle: tcf.displayStyle || "auto",
          }));
      }
    }

    // Merge global + team fields
    const allFields = [...globalFields, ...teamCustomFields];
    const normalizedAvailability = settings?.fieldAvailability
      ? settings.fieldAvailability.map((entry) => ({
          fieldKey: entry.fieldKey,
          roleAccess: entry.roleAccess
            ? Object.fromEntries(
                Object.entries(entry.roleAccess).map(([roleId, value]) => [
                  roleId,
                  normalizeAccessValue(value),
                ])
              )
            : undefined,
          teamAccess: entry.teamAccess
            ? Object.fromEntries(
                Object.entries(entry.teamAccess).map(([teamId, value]) => [
                  teamId,
                  normalizeAccessValue(value),
                ])
              )
            : undefined,
        }))
      : [];

    return NextResponse.json({
      fields: allFields,
      availability: normalizedAvailability,
    });
  } catch (error) {
    console.error("Error fetching field configuration:", error);
    return NextResponse.json(
      { error: "Failed to fetch field configuration" },
      { status: 500 }
    );
  }
}
