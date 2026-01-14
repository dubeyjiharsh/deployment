"use client";

/**
 * SimpleListEditor
 *
 * Editor for simple string arrays (lists).
 * Used for: Objectives, Success criteria, Assumptions, Relevant Facts
 *
 * UI: Simple list of text inputs with add/remove/reorder
 */

import * as React from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { StructuredFieldEditorProps } from "./index";
// Added//
import { API_ENDPOINTS } from '@/config/api';
import { toast } from "sonner";

/**
 * Normalizes value to string array
 */
function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null) {
        // Try to extract text from object
        const obj = item as Record<string, unknown>;
        return (
          String(obj.text || obj.value || obj.name || obj.title || obj.description || JSON.stringify(item))
        );
      }
      return String(item);
    });
  }
  if (typeof value === "string") {
    // Split by newlines if it's a multi-line string
    return value.split("\n").filter((line) => line.trim());
  }
  return [];
}


// Helper functions from CanvasPreviewPage
function parseJsonIfString(v: unknown) {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch (e) {
      return v;
    }
  }
  return v;
}

function transformFieldsToCanvas(fields: any) {
  const makeField = (value: any) => ({ value: value ?? null, evidence: [], confidence: 0.5 });

  const parseArray = (arr: any) => {
    if (!Array.isArray(arr)) return arr ?? [];
    return arr.map((it) => parseJsonIfString(it));
  };

  const nfrRaw = fields["Non Functional Requirements"] || fields.non_functional_requirements || [];
  const organizedNFRs: any = {};
  if (Array.isArray(nfrRaw)) {
    nfrRaw.forEach((item: any) => {
      const cat = item.category || "General";
      const req = item.requirement || "";
      if (!organizedNFRs[cat]) organizedNFRs[cat] = [];
      organizedNFRs[cat].push(req);
    });
  }

  let relevantFactsRaw = fields.RelevantFacts || fields.relevantFacts || [];
  let relevantFactsArr: string[] = Array.isArray(relevantFactsRaw)
    ? relevantFactsRaw.filter((v) => typeof v === 'string')
    : [];

  return {
    id: fields.canvas_id || fields.canvasId || "",
    title: makeField(fields.Title || fields.title || "Untitled Canvas"),
    problemStatement: makeField(fields.problem_statement || fields.problemStatement || fields["Problem Statement"]),
    objectives: makeField(parseArray(fields.Objectives || fields.objectives)),
    kpis: makeField(parseArray(fields.KPIs || fields.kpis)),
    successCriteria: makeField(parseArray(fields["Success Criteria"] || fields.success_criteria)),
    keyFeatures: makeField(parseArray(fields["Key Features"] || fields.key_features)),
    risks: makeField(parseArray(fields.Risks || fields.risks)),
    assumptions: makeField(parseArray(fields.Assumptions || fields.assumptions)),
    nonFunctionalRequirements: makeField(parseArray(fields["Non Functional Requirements"] || fields.non_functional_requirements)),
    useCases: makeField(parseArray(fields["Use Cases"] || fields.use_cases)),
    governance: makeField(fields.Governance || fields.governance || {}),
    relevantFacts: makeField(parseArray(fields.relevantFacts || fields.relevantFacts)),
    createdAt: fields.created_at || fields.createdAt || new Date().toISOString(),
    updatedAt: fields.updated_at || fields.updatedAt || new Date().toISOString(),
  };
}

function mapCanvasToBackendPayload(canvas: any) {
  const nfrRaw = canvas.nonFunctionalRequirements?.value || {};
  const formattedNFRs = Object.entries(nfrRaw).flatMap(([category, requirements]) => {
    if (Array.isArray(requirements)) {
      return requirements.map(req => ({
        category: category,
        requirement: typeof req === 'string' ? req : JSON.stringify(req)
      }));
    }
    return [];
  });

  return {
    "Title": canvas.title?.value || "",
    "Problem Statement": canvas.problemStatement?.value || "",
    "Objectives": Array.isArray(canvas.objectives?.value) ? canvas.objectives.value : [],
    "KPIs": Array.isArray(canvas.kpis?.value) ? canvas.kpis.value : [],
    "Success Criteria": Array.isArray(canvas.successCriteria?.value) ? canvas.successCriteria.value : [],
    "Key Features": Array.isArray(canvas.keyFeatures?.value) ? canvas.keyFeatures.value : [],
    "Risks": Array.isArray(canvas.risks?.value) ? canvas.risks.value : [],
    "Assumptions": Array.isArray(canvas.assumptions?.value) ? canvas.assumptions.value : [],
    "Non Functional Requirements": Array.isArray(canvas.nonFunctionalRequirements?.value) ? canvas.nonFunctionalRequirements.value : [],
    "Governance": typeof canvas.governance?.value === 'object' && canvas.governance?.value !== null
      ? canvas.governance.value
      : {},
    "Relevant Facts": Array.isArray(canvas.relevantFacts?.value) ? canvas.relevantFacts.value : [],
    "Use Cases": Array.isArray(canvas.useCases?.value) ? canvas.useCases.value : [],
  };
}

export function SimpleListEditor({
  value,
  onChange,
  onSave,
  onCancel,
  isSaving,
  fieldKey, // Added fieldKey as a prop
}: StructuredFieldEditorProps & { fieldKey: keyof ReturnType<typeof transformFieldsToCanvas> }): React.ReactElement {
  const [isActuallySaving, setIsActuallySaving] = React.useState(false);
  const items = React.useMemo(() => normalizeList(value), [value]);
  const [newItemText, setNewItemText] = React.useState("");
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const newItemInputRef = React.useRef<HTMLInputElement>(null);

  const handleAddItem = () => {
    const text = newItemText.trim();
    if (!text) return;

    onChange([...items, text]);
    setNewItemText("");
    newItemInputRef.current?.focus();
  };

  const handleUpdateItem = (index: number, newText: string) => {
    const newItems = [...items];
    newItems[index] = newText;
    onChange(newItems);
  };

  const handleDeleteItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleMoveItem = (fromIndex: number, toIndex: number) => {
    const newItems = [...items];
    const [removed] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, removed);
    onChange(newItems);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddItem();
    }
  };

  const handleSaveChanges = async (): Promise<void> => {
    setIsActuallySaving(true);

    try {
      // Get canvas ID from sessionStorage
      const canvasId = sessionStorage.getItem("canvasId");
      if (!canvasId) {
        toast.error("No canvas ID found");
        return;
      }

      // Get the full canvas data from sessionStorage
      const canvasJsonStr = sessionStorage.getItem("canvasJson");
      if (!canvasJsonStr) {
        toast.error("No canvas data found");
        return;
      }

      const canvasJson = JSON.parse(canvasJsonStr);
      const canvas = transformFieldsToCanvas(canvasJson);

      // Update the specific field with current value
      if (canvas[fieldKey]) {
        canvas[fieldKey].value = value;
      }

      // Convert to backend payload format
      const payload = mapCanvasToBackendPayload(canvas);

      // Make the API call
      const url = API_ENDPOINTS.canvasSave(canvasId);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionStorage.getItem("authToken") || ""}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      // Update sessionStorage with new data
      sessionStorage.setItem("canvasJson", JSON.stringify(data.fields || data));

      toast.success("Canvas saved successfully!");

      // Call the original onSave callback if provided
      if (onSave) {
        onSave();
      }

      // Reload the page after a short delay to show the toast
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      toast.error("Failed to save canvas");
      console.error("Failed to save canvas:", error);
    } finally {
      setIsActuallySaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* List items */}
      <div className="space-y-2">
        {items.map((item, index) => (
          <ListItem
            key={`${index}-${item.slice(0, 30)}`}
            text={item}
            index={index}
            totalCount={items.length}
            isEditing={editingIndex === index}
            onStartEdit={() => setEditingIndex(index)}
            onFinishEdit={() => setEditingIndex(null)}
            onChange={(newText) => handleUpdateItem(index, newText)}
            onDelete={() => handleDeleteItem(index)}
            onMoveUp={() => index > 0 && handleMoveItem(index, index - 1)}
            onMoveDown={() =>
              index < items.length - 1 && handleMoveItem(index, index + 1)
            }
          />
        ))}

        {items.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
            No items yet. Add one below.
          </div>
        )}
      </div>

      {/* Add new item */}
      <div className="flex items-center gap-2">
        <Input
          ref={newItemInputRef}
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add new item..."
          className="flex-1 h-10"
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleAddItem}
          disabled={!newItemText.trim()}
          className="h-10 px-4"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t">
        {/* <Button variant="outline" onClick={onCancel} disabled={isSaving}> */}
        <Button variant="outline" onClick={onCancel} disabled={isActuallySaving || isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSaveChanges} disabled={isActuallySaving || isSaving}>
          {isActuallySaving || isSaving ? "Saving..." : "Save Changes"}
        </Button>
        {/* <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Changes"}
        </Button> */}
      </div>
    </div>
  );
}

/**
 * Individual list item component
 */
interface ListItemProps {
  text: string;
  index: number;
  totalCount: number;
  isEditing: boolean;
  onStartEdit: () => void;
  onFinishEdit: () => void;
  onChange: (newText: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function ListItem({
  text,
  index,
  totalCount,
  isEditing,
  onStartEdit,
  onFinishEdit,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: ListItemProps): React.ReactElement {
  const [editText, setEditText] = React.useState(text);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  React.useEffect(() => {
    setEditText(text);
  }, [text]);

  const handleSave = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== text) {
      onChange(trimmed);
    } else {
      setEditText(text); // Reset if empty or unchanged
    }
    onFinishEdit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      setEditText(text);
      onFinishEdit();
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 group rounded-lg border bg-card",
        "hover:shadow-sm transition-all",
        "px-2 py-1"
      )}
    >
      {/* Drag handle */}
      <div className="flex flex-col items-center">
        <div className="cursor-grab opacity-30 group-hover:opacity-60">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Move buttons */}
      {totalCount > 1 && (
        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onMoveUp}
            disabled={index === 0}
            className="h-5 w-5"
            aria-label="Move up"
          >
            <span className="text-xs">^</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onMoveDown}
            disabled={index === totalCount - 1}
            className="h-5 w-5"
            aria-label="Move down"
          >
            <span className="text-xs rotate-180">^</span>
          </Button>
        </div>
      )}

      {/* Content */}
      {isEditing ? (
        <Input
          ref={inputRef}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="flex-1 h-8"
        />
      ) : (
        <div
          className="flex-1 py-2 px-2 text-sm cursor-text rounded hover:bg-muted/30"
          onClick={onStartEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onStartEdit();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={`Edit: ${text}`}
        >
          {text}
        </div>
      )}

      {/* Delete button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="h-8 w-8 opacity-60 group-hover:opacity-100 text-black hover:text-black"
        //className="h-8 w-8 opacity-60 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
        aria-label="Delete item"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
