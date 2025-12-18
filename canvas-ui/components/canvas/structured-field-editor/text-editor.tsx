"use client";

/**
 * TextEditor
 *
 * Fallback editor for plain text fields or unknown object types.
 * Used for: Simple text fields, unknown object structures
 *
 * UI: Textarea for text, or read-only JSON display for unknown objects
 */

import * as React from "react";
import { AlertCircle, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { StructuredFieldEditorProps } from "./index";

/**
 * Converts value to editable string representation
 */
function valueToString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    // Check if it's a simple string array
    if (value.every((item) => typeof item === "string")) {
      return value.join("\n");
    }
    // Complex array - show as JSON
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

/**
 * Tries to parse string back to original type
 */
function parseStringValue(text: string, originalValue: unknown): unknown {
  const trimmed = text.trim();

  // If original was null/undefined and text is empty, return null
  if (!trimmed && (originalValue === null || originalValue === undefined)) {
    return null;
  }

  // If original was a string, return as string
  if (typeof originalValue === "string") {
    return text;
  }

  // If original was a simple string array, split by newlines
  if (
    Array.isArray(originalValue) &&
    originalValue.every((item) => typeof item === "string")
  ) {
    return trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);
  }

  // Try to parse as JSON for objects/complex arrays
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Return as string if JSON parse fails
      return text;
    }
  }

  return text;
}

/**
 * Checks if value is an unknown complex structure
 */
function isComplexUnknown(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0 && typeof value[0] === "object";
  }
  return true;
}

export function TextEditor({
  value,
  onChange,
  onSave,
  onCancel,
  isSaving,
}: StructuredFieldEditorProps): React.ReactElement {
  const [text, setText] = React.useState(() => valueToString(value));
  const [parseError, setParseError] = React.useState<string | null>(null);
  const isComplex = isComplexUnknown(value);

  // Update text when value changes externally
  React.useEffect(() => {
    setText(valueToString(value));
  }, [value]);

  const handleTextChange = (newText: string) => {
    setText(newText);
    setParseError(null);

    // Try to parse and validate
    try {
      const parsed = parseStringValue(newText, value);
      onChange(parsed);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Invalid format");
    }
  };

  const handleSave = () => {
    try {
      const parsed = parseStringValue(text, value);
      onChange(parsed);
      onSave();
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Invalid format");
    }
  };

  return (
    <div className="space-y-4">
      {/* Warning for complex structures */}
      {isComplex && (
        <Alert>
          <Code2 className="h-4 w-4" />
          <AlertDescription className="text-sm">
            This field has a complex structure. Edit carefully to maintain the format.
            Invalid changes may cause display issues.
          </AlertDescription>
        </Alert>
      )}

      {/* Parse error */}
      {parseError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}

      {/* Text area */}
      <Textarea
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder="Enter content..."
        className={cn(
          "min-h-[200px] resize-y",
          isComplex && "font-mono text-sm"
        )}
      />

      {/* Help text */}
      {!isComplex && (
        <p className="text-xs text-muted-foreground">
          {Array.isArray(value) && value.every((item) => typeof item === "string")
            ? "Enter one item per line"
            : "Enter your content above"}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving || !!parseError}>
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
