import type { FieldConfiguration } from "@/lib/validators/settings-schema";
import type { BusinessCanvas } from "@/lib/validators/canvas-schema";

/**
 * Migration function for canvas field configuration changes
 *
 * This function handles data preservation when field configuration changes:
 * - Enabled fields: Display normally
 * - Disabled fields: Hide from UI but preserve data (no deletion)
 * - Team custom fields: Always preserved (additive only)
 *
 * Note: This is a "soft" migration - we don't actually modify canvas data,
 * we just filter what's displayed in the UI based on field configuration.
 */
export interface MigrationResult {
  migratedCount: number;
  skippedCount: number;
  errors: string[];
}

/**
 * Validates that a canvas has all enabled fields
 * Returns missing fields that should be generated
 */
export function validateCanvasFields(
  canvas: BusinessCanvas,
  fieldConfiguration: FieldConfiguration[]
): string[] {
  const enabledFieldKeys = fieldConfiguration
    .filter(f => f.enabled)
    .map(f => f.fieldKey);

  const missingFields: string[] = [];

  for (const fieldKey of enabledFieldKeys) {
    const field = canvas[fieldKey as keyof BusinessCanvas];

    // Check if field is missing or has no value
    if (!field || (typeof field === 'object' && 'value' in field && field.value === null)) {
      missingFields.push(fieldKey);
    }
  }

  return missingFields;
}

/**
 * Filters canvas fields based on field configuration
 * This is used in the UI layer to determine which fields to display
 */
export function filterCanvasFields(
  canvas: BusinessCanvas,
  fieldConfiguration: FieldConfiguration[]
): Record<string, boolean> {
  const visibilityMap: Record<string, boolean> = {};

  fieldConfiguration.forEach(field => {
    visibilityMap[field.fieldKey] = field.enabled;
  });

  return visibilityMap;
}

/**
 * Gets a list of disabled fields that exist in a canvas
 * These fields have data but should be hidden from the UI
 */
export function getHiddenFields(
  canvas: BusinessCanvas,
  fieldConfiguration: FieldConfiguration[]
): Array<{ key: string; name: string; hasData: boolean }> {
  const disabledFields = fieldConfiguration.filter(f => !f.enabled);
  const hiddenFields: Array<{ key: string; name: string; hasData: boolean }> = [];

  disabledFields.forEach(field => {
    const canvasField = canvas[field.fieldKey as keyof BusinessCanvas];
    const hasData = canvasField &&
                   typeof canvasField === 'object' &&
                   'value' in canvasField &&
                   canvasField.value !== null &&
                   canvasField.value !== undefined;

    if (hasData) {
      hiddenFields.push({
        key: field.fieldKey,
        name: field.name,
        hasData: true
      });
    }
  });

  return hiddenFields;
}

/**
 * Migration log entry for audit trail
 */
export interface MigrationLogEntry {
  timestamp: string;
  canvasId: string;
  action: 'field_hidden' | 'field_restored' | 'field_added';
  fieldKey: string;
  fieldName: string;
  details?: string;
}

/**
 * Creates a migration log entry
 */
export function createMigrationLogEntry(
  canvasId: string,
  action: MigrationLogEntry['action'],
  fieldKey: string,
  fieldName: string,
  details?: string
): MigrationLogEntry {
  return {
    timestamp: new Date().toISOString(),
    canvasId,
    action,
    fieldKey,
    fieldName,
    details,
  };
}

/**
 * Analyzes the impact of a field configuration change
 * Returns statistics about what will be affected
 */
export function analyzeMigrationImpact(
  canvases: BusinessCanvas[],
  oldConfig: FieldConfiguration[],
  newConfig: FieldConfiguration[]
): {
  fieldsHidden: string[];
  fieldsRestored: string[];
  fieldsAdded: string[];
  affectedCanvases: number;
  dataPreserved: boolean;
} {
  const oldEnabledKeys = new Set(oldConfig.filter(f => f.enabled).map(f => f.fieldKey));
  const newEnabledKeys = new Set(newConfig.filter(f => f.enabled).map(f => f.fieldKey));
  const oldKeys = new Set(oldConfig.map(f => f.fieldKey));
  const newKeys = new Set(newConfig.map(f => f.fieldKey));

  const fieldsHidden: string[] = [];
  const fieldsRestored: string[] = [];
  const fieldsAdded: string[] = [];

  // Find hidden fields (was enabled, now disabled)
  oldConfig.forEach(field => {
    if (oldEnabledKeys.has(field.fieldKey) && !newEnabledKeys.has(field.fieldKey)) {
      fieldsHidden.push(field.fieldKey);
    }
  });

  // Find restored fields (was disabled, now enabled)
  oldConfig.forEach(field => {
    if (!oldEnabledKeys.has(field.fieldKey) && newEnabledKeys.has(field.fieldKey)) {
      fieldsRestored.push(field.fieldKey);
    }
  });

  // Find added fields (new fields in configuration)
  newConfig.forEach(field => {
    if (!oldKeys.has(field.fieldKey)) {
      fieldsAdded.push(field.fieldKey);
    }
  });

  // Count affected canvases (canvases with data in hidden fields)
  let affectedCanvases = 0;
  if (fieldsHidden.length > 0) {
    affectedCanvases = canvases.filter(canvas => {
      return fieldsHidden.some(fieldKey => {
        const field = canvas[fieldKey as keyof BusinessCanvas];
        return field && typeof field === 'object' && 'value' in field && field.value !== null;
      });
    }).length;
  }

  return {
    fieldsHidden,
    fieldsRestored,
    fieldsAdded,
    affectedCanvases,
    dataPreserved: true, // We always preserve data, just hide from UI
  };
}
