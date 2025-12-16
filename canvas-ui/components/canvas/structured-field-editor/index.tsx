"use client";

/**
 * StructuredFieldEditor
 *
 * A smart editor component that renders appropriate UI based on field type.
 * Users never see JSON - they interact with intuitive forms.
 *
 * Supports:
 * - Category lists (NFR, Scope) - collapsible sections with item lists
 * - Timelines - date pickers and milestone cards
 * - Card arrays (Personas, Stakeholders, etc.) - draggable cards with forms
 * - Simple lists - basic string arrays
 * - Fallback text editor for unknown types
 */

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  getStructuredFieldConfig,
  validateStructuredField,
  type StructuredFieldType,
} from "@/lib/validators/structured-field-schemas";
import { CategoryListEditor } from "./category-list-editor";
import { TimelineEditor } from "./timeline-editor";
import { CardArrayEditor } from "./card-array-editor";
import { GovernanceEditor } from "./governance-editor";
import { BudgetEditor } from "./budget-editor";
import { SimpleListEditor } from "./simple-list-editor";
import { TextEditor } from "./text-editor";

export interface StructuredFieldEditorProps {
  /** The field key (e.g., "nonFunctionalRequirements") */
  fieldKey: string;
  /** Current field value */
  value: unknown;
  /** Callback when value changes - called on every edit */
  onChange: (value: unknown) => void;
  /** Callback when user wants to save */
  onSave: () => void;
  /** Callback when user wants to cancel */
  onCancel: () => void;
  /** Whether the editor is in a saving state */
  isSaving?: boolean;
  /** Optional class name */
  className?: string;
}

/**
 * Main structured field editor component
 * Automatically detects field type and renders the appropriate editor
 */
export function StructuredFieldEditor({
  fieldKey,
  value,
  onChange,
  onSave,
  onCancel,
  isSaving = false,
  className,
}: StructuredFieldEditorProps): React.ReactElement {
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [localValue, setLocalValue] = React.useState<unknown>(value);

  // Get field configuration
  const config = getStructuredFieldConfig(fieldKey);

  // Determine editor type
  const editorType: StructuredFieldType = config?.type ?? detectEditorType(value);

  // Handle value changes with validation
  const handleChange = React.useCallback((newValue: unknown) => {
    setLocalValue(newValue);
    setValidationError(null);

    // Validate if we have a schema
    if (config) {
      const result = validateStructuredField(fieldKey, newValue);
      if (!result.success) {
        setValidationError(result.error);
      }
    }

    onChange(newValue);
  }, [fieldKey, config, onChange]);

  // Handle save with final validation
  const handleSave = React.useCallback(() => {
    if (config) {
      const result = validateStructuredField(fieldKey, localValue);
      if (!result.success) {
        setValidationError(result.error);
        return;
      }
    }
    onSave();
  }, [fieldKey, localValue, config, onSave]);

  // Initialize with normalized value
  React.useEffect(() => {
    if (config && value !== undefined) {
      const result = validateStructuredField(fieldKey, value);
      if (result.success) {
        setLocalValue(result.data);
      } else {
        // Use empty value if current value is invalid
        setLocalValue(config.emptyValue);
      }
    } else {
      setLocalValue(value);
    }
  }, [fieldKey, value, config]);

  // Common props for all editors
  const editorProps = {
    fieldKey,
    value: localValue,
    onChange: handleChange,
    onSave: handleSave,
    onCancel,
    isSaving,
    className,
  };

  return (
    <div className={className}>
      {validationError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      {renderEditor(editorType, editorProps)}
    </div>
  );
}

/**
 * Renders the appropriate editor based on type
 */
function renderEditor(
  type: StructuredFieldType,
  props: StructuredFieldEditorProps
): React.ReactElement {
  switch (type) {
    case "category-list":
      return <CategoryListEditor {...props} />;

    case "timeline":
      return <TimelineEditor {...props} />;

    case "card-array":
      return <CardArrayEditor {...props} />;

    case "governance":
      return <GovernanceEditor {...props} />;

    case "budget":
      return <BudgetEditor {...props} />;

    case "simple-list":
      return <SimpleListEditor {...props} />;

    case "text":
    case "unknown-object":
    default:
      return <TextEditor {...props} />;
  }
}

/**
 * Detects editor type from value when no schema is defined
 */
function detectEditorType(value: unknown): StructuredFieldType {
  if (value === null || value === undefined) {
    return "text";
  }

  if (typeof value === "string") {
    return "text";
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "simple-list";
    }
    if (typeof value[0] === "string") {
      return "simple-list";
    }
    if (typeof value[0] === "object") {
      return "card-array";
    }
    return "simple-list";
  }

  if (typeof value === "object") {
    // Check for known patterns
    const keys = Object.keys(value as object);

    // Check for category-list pattern (all values are arrays)
    const allArrays = keys.every(
      key => Array.isArray((value as Record<string, unknown>)[key])
    );
    if (allArrays && keys.length > 0) {
      return "category-list";
    }

    return "unknown-object";
  }

  return "text";
}

// Re-export sub-components for direct use if needed
export { CategoryListEditor } from "./category-list-editor";
export { TimelineEditor } from "./timeline-editor";
export { CardArrayEditor } from "./card-array-editor";
export { GovernanceEditor } from "./governance-editor";
export { BudgetEditor } from "./budget-editor";
export { SimpleListEditor } from "./simple-list-editor";
export { TextEditor } from "./text-editor";
