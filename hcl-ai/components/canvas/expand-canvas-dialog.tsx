"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";

interface ExpandCanvasDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExpand: (selectedFields: string[]) => Promise<void>;
  existingFields: string[];
  fieldConfiguration?: Array<{
    fieldKey: string;
    name: string;
    description?: string;
    enabled: boolean;
    includeInGeneration?: boolean;
  }>;
}

/**
 * Dialog for selecting and expanding additional canvas fields
 */
export function ExpandCanvasDialog({
  isOpen,
  onClose,
  onExpand,
  existingFields,
  fieldConfiguration,
}: ExpandCanvasDialogProps): React.ReactElement {
  const [selectedFields, setSelectedFields] = React.useState<string[]>([]);
  const [isExpanding, setIsExpanding] = React.useState(false);

  // Build expandable fields from configuration: enabled but NOT includeInGeneration
  const expandableFields = fieldConfiguration
    ? fieldConfiguration
        .filter(f => {
          const shouldInclude = f.enabled && !(f.includeInGeneration ?? true);
          return shouldInclude;
        })
        .map(f => ({
          key: f.fieldKey,
          label: f.name,
          description: f.description || `Add ${f.name} to the canvas`,
        }))
    : [];

  const availableFields = expandableFields.filter(
    (field) => !existingFields.includes(field.key)
  );

  const handleToggleField = (fieldKey: string): void => {
    setSelectedFields((prev) =>
      prev.includes(fieldKey)
        ? prev.filter((key) => key !== fieldKey)
        : [...prev, fieldKey]
    );
  };

  const handleSelectAll = (checked: boolean | string): void => {
    if (checked === true) {
      setSelectedFields(availableFields.map((field) => field.key));
    } else {
      setSelectedFields([]);
    }
  };

  const handleExpand = async (): Promise<void> => {
    if (selectedFields.length === 0) return;

    setIsExpanding(true);
    try {
      await onExpand(selectedFields);
      setSelectedFields([]);
      onClose();
    } catch (error) {
      console.error("Failed to expand canvas:", error);
      // Error is already handled by parent component
      // Just reset the expanding state
    } finally {
      setIsExpanding(false);
    }
  };

  const hasFieldsToExpand = availableFields.length > 0;
  const isAllSelected = selectedFields.length === availableFields.length && availableFields.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Expand Canvas with Additional Fields</DialogTitle>
          <DialogDescription>
            Select additional strategic fields to populate. Claude will use MCP data and uploaded documents when available,
            and will only populate fields where it has sufficient evidence.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!hasFieldsToExpand ? (
            <div className="text-center py-8 text-muted-foreground">
              All additional fields have already been expanded.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                  />
                  <Label
                    htmlFor="select-all"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Select all ({availableFields.length} fields)
                  </Label>
                </div>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {availableFields.map((field) => (
                  <div
                    key={field.key}
                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      id={field.key}
                      checked={selectedFields.includes(field.key)}
                      onCheckedChange={() => handleToggleField(field.key)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 space-y-1">
                      <Label
                        htmlFor={field.key}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {field.label}
                      </Label>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {field.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isExpanding}>
            Cancel
          </Button>
          {hasFieldsToExpand && (
            <Button
              onClick={handleExpand}
              disabled={selectedFields.length === 0 || isExpanding}
            >
              {isExpanding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Expanding...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Expand {selectedFields.length} Field{selectedFields.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
