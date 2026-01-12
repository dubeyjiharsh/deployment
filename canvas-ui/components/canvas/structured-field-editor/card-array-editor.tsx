"use client";

/**
 * CardArrayEditor
 *
 * Editor for arrays of objects (cards).
 * Used for: KPI, Key features, Risks, Use cases.
 *
 * UI: Cards with form fields, add/remove/reorder functionality
 * Dynamically renders fields based on field key configuration
 */

import * as React from "react";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  KPIS_FIELD_LABELS,
  KEY_FEATURES_FIELD_LABELS,
  RISKS_FIELD_LABELS,
  USE_CASE_FIELD_LABELS,
} from "@/lib/validators/structured-field-schemas";
import type { StructuredFieldEditorProps } from "./index";
import { API_ENDPOINTS } from '@/config/api';
import { toast } from "sonner";

type CardItem = Record<string, unknown>;

// Configuration for a single field in a card (used to render form fields)
interface FieldConfig {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}

/**
 * Returns the field configuration for different card types
 * Used to dynamically render the correct fields for each card type in the editor UI.
 */
function getFieldConfig(fieldKey: string): FieldConfig[] {
  switch (fieldKey) {
    case "kpis":
      return [
        { key: "metric", label: KPIS_FIELD_LABELS.metric, type: "text", required: true, placeholder: "Metric being measured..." },
        { key: "baseline", label: KPIS_FIELD_LABELS.baseline, type: "text", placeholder: "Current value..." },
        { key: "target", label: KPIS_FIELD_LABELS.target, type: "text", placeholder: "Target value..." },
        { key: "measurement_frequency", label: KPIS_FIELD_LABELS.measurement_frequency, type: "text", placeholder: "How often measured..." },
      ];

    case "keyFeatures":
      return [
        { key: "feature", label: KEY_FEATURES_FIELD_LABELS.feature, type: "text", required: true, placeholder: "Feature name..." },
        { key: "description", label: KEY_FEATURES_FIELD_LABELS.description, type: "textarea", placeholder: "Feature description..." },
        { key: "priority", label: KEY_FEATURES_FIELD_LABELS.priority, type: "text", placeholder: "Priority (e.g., P1, P2, P3)..." },
      ];

    case "risks":
      return [
        { key: "risk", label: RISKS_FIELD_LABELS.risk, type: "textarea", required: true, placeholder: "Describe the risk..." },
        { key: "mitigation", label: RISKS_FIELD_LABELS.mitigation, type: "textarea", placeholder: "Mitigation strategies..." },
      ];

    case "useCases":
      return [
        { key: "use_case", label: USE_CASE_FIELD_LABELS.use_case, type: "text", required: true, placeholder: "e.g., Use Case 1" },
        { key: "actor", label: USE_CASE_FIELD_LABELS.actor, type: "text", placeholder: "Who performs this action..." },
        { key: "goal", label: USE_CASE_FIELD_LABELS.goal, type: "textarea", placeholder: "What they want to achieve..." },
        { key: "scenario", label: USE_CASE_FIELD_LABELS.scenario, type: "textarea", placeholder: "Step-by-step description..." },
      ];

    default:
      // For unknown array types, derive fields from first item
      return [];
  }
}

/**
 * Returns a display title for a card item, falling back to a default if not present.
 * Used for the card header display in the UI.
 */
function getCardTitle(item: CardItem, fieldKey: string, index: number): string {
  // Try to get the main identifying field for each type
  let name: unknown;
  
  switch (fieldKey) {
    case "kpis":
      name = item.metric;
      break;
    case "keyFeatures":
      name = item.feature;
      break;
    case "risks":
      name = item.risk;
      break;
    case "useCases":
      name = item.use_case;
      break;
    default:
      name = item.name || item.title || item.metric;
  }

  if (typeof name === "string" && name.trim()) {
    return name.length > 50 ? name.substring(0, 50) + "..." : name;
  }

  // Fallback titles
  switch (fieldKey) {
    case "kpis":
      return `KPI ${index + 1}`;
    case "keyFeatures":
      return `Feature ${index + 1}`;
    case "risks":
      return `Risk ${index + 1}`;
    case "useCases":
      return `Use Case ${index + 1}`;
    default:
      return `Item ${index + 1}`;
  }
}

/**
 * Creates an empty card item for a given field type.
 * Used when adding a new card to the array.
 */
function createEmptyItem(fieldKey: string): CardItem {
  switch (fieldKey) {
    case "kpis":
      return { metric: "", baseline: "", target: "", measurement_frequency: "" };
    case "keyFeatures":
      return { feature: "", description: "", priority: "" };
    case "risks":
      return { risk: "", mitigation: "" };
    case "useCases":
      return { use_case: "", actor: "", goal: "", scenario: "" };
    default:
      return {};
  }
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
    relevantFacts: makeField(parseArray(fields.RelevantFacts || fields.relevantFacts)),
    createdAt: fields.created_at || fields.createdAt || new Date().toISOString(),
    updatedAt: fields.updated_at || fields.updatedAt || new Date().toISOString(),
  };
}

// Maps the internal canvas object to the backend payload format.
function mapCanvasToBackendPayload(canvas: any) {
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

export function CardArrayEditor({
  fieldKey,
  value,
  onChange,
  onSave,
  onCancel,
  isSaving,
}: StructuredFieldEditorProps & { fieldKey: keyof ReturnType<typeof transformFieldsToCanvas> }): React.ReactElement {
  const [isActuallySaving, setIsActuallySaving] = React.useState(false);

  // Normalize value to array
  const items: CardItem[] = React.useMemo(() => {
    if (Array.isArray(value)) {
      return value as CardItem[];
    }
    if (value && typeof value === "object" && Array.isArray((value as any).value)) {
      return (value as any).value as CardItem[];
    }
    return [];
  }, [value]);

  // Use a ref to maintain stable keys for items across renders
  const itemKeysRef = React.useRef<Map<number, string>>(new Map());
  const keyCounterRef = React.useRef(0);

  // Generate stable keys for current items
  const getItemKey = React.useCallback((index: number): string => {
    if (!itemKeysRef.current.has(index)) {
      itemKeysRef.current.set(index, `card-${++keyCounterRef.current}`);
    }
    return itemKeysRef.current.get(index)!;
  }, []);

  // Clean up keys when items array length changes
  React.useEffect(() => {
    const currentKeys = itemKeysRef.current;
    currentKeys.forEach((_, idx) => {
      if (idx >= items.length) {
        currentKeys.delete(idx);
      }
    });
  }, [items.length]);

  // Get field configuration
  const fields = React.useMemo(() => {
    const config = getFieldConfig(fieldKey);
    if (config.length > 0) return config;

    // Derive from first item if no config
    if (items.length > 0) {
      return Object.keys(items[0]).map(key => ({
        key,
        label: key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase()),
        type: "text" as const,
      }));
    }

    return [];
  }, [fieldKey, items]);

  // Track which cards are expanded
  const [expandedCards, setExpandedCards] = React.useState<Set<number>>(
    new Set(items.length > 0 ? [0] : [])
  );

  const toggleCard = (index: number) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleAddItem = () => {
    const newItem = createEmptyItem(fieldKey);
    const newItems = [...items, newItem];
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      onChange({ ...value, value: newItems });
    } else {
      onChange(newItems);
    }
    setExpandedCards(prev => new Set([...prev, newItems.length - 1]));
  };

  const handleUpdateItem = (index: number, updates: Partial<CardItem>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      onChange({ ...value, value: newItems });
    } else {
      onChange(newItems);
    }
  };

  const handleDeleteItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      onChange({ ...value, value: newItems });
    } else {
      onChange(newItems);
    }
    setExpandedCards(prev => {
      const next = new Set<number>();
      prev.forEach(i => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  };

  const handleMoveItem = (fromIndex: number, toIndex: number) => {
    const newItems = [...items];
    const [removed] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, removed);
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      onChange({ ...value, value: newItems });
    } else {
      onChange(newItems);
    }
  };

  const handleSaveChanges = async (): Promise<void> => {
    setIsActuallySaving(true);

    try {
      const canvasId = sessionStorage.getItem("canvasId");
      if (!canvasId) {
        toast.error("No canvas ID found");
        return;
      }

      const canvasJsonStr = sessionStorage.getItem("canvasJson");
      if (!canvasJsonStr) {
        toast.error("No canvas data found");
        return;
      }

      const canvasJson = JSON.parse(canvasJsonStr);
      const canvas = transformFieldsToCanvas(canvasJson);

      // Update the specific field with current value
      if (fieldKey in canvas) {
        (canvas as any)[fieldKey].value = items;
      }

      const payload = mapCanvasToBackendPayload(canvas);

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
      sessionStorage.setItem("canvasJson", JSON.stringify(data.fields || data));

      toast.success("Canvas saved successfully!");

      if (onSave) {
        onSave();
      }

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
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
      {/* Cards */}
      <div className="space-y-3">
        {items.map((item, index) => {
          const isExpanded = expandedCards.has(index);
          const title = getCardTitle(item, fieldKey, index);

          return (
            <Collapsible
              key={getItemKey(index)}
              open={isExpanded}
              onOpenChange={() => toggleCard(index)}
            >
              <Card className="group">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3 px-4">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <div
                        className="cursor-grab opacity-30 group-hover:opacity-60"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </div>

                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}

                      <span className="flex-1 truncate">{title}</span>

                      {items.length > 1 && (
                        <div
                          className="flex gap-1 opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => index > 0 && handleMoveItem(index, index - 1)}
                            disabled={index === 0}
                            className="h-6 w-6"
                            aria-label="Move up"
                          >
                            <span className="text-xs">↑</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              index < items.length - 1 &&
                              handleMoveItem(index, index + 1)
                            }
                            disabled={index === items.length - 1}
                            className="h-6 w-6"
                            aria-label="Move down"
                          >
                            <span className="text-xs">↓</span>
                          </Button>
                        </div>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteItem(index);
                        }}
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        aria-label="Delete item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0 pb-4 px-4">
                    <div className="grid gap-4">
                      {fields.map((field) => (
                        <CardField
                          key={field.key}
                          field={field}
                          value={item[field.key]}
                          onChange={(newValue) =>
                            handleUpdateItem(index, { [field.key]: newValue })
                          }
                          itemIndex={index}
                        />
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}

        {items.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
            No items yet. Add one to get started.
          </div>
        )}
      </div>

      {/* Add button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddItem}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add {fieldKey === "kpis" ? "KPI" :
              fieldKey === "keyFeatures" ? "Feature" :
              fieldKey === "risks" ? "Risk" :
              fieldKey === "useCases" ? "Use Case" : "Item"}
      </Button>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t bg-background sticky bottom-0 z-10">
        <Button variant="outline" onClick={onCancel} disabled={isActuallySaving || isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSaveChanges} disabled={isActuallySaving || isSaving}>
          {isActuallySaving || isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Individual card field component
 */
interface CardFieldProps {
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  itemIndex: number;
}

function CardField({ field, value, onChange, itemIndex }: CardFieldProps): React.ReactElement {
  const id = `${field.key}-${itemIndex}`;
  const stringValue = typeof value === "string" ? value : String(value ?? "");

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {field.type === "textarea" ? (
        <Textarea
          id={id}
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="min-h-[60px] resize-none text-sm"
        />
      ) : field.type === "select" && field.options ? (
        <Select
          value={stringValue || "_empty_"}
          onValueChange={(newValue) => onChange(newValue === "_empty_" ? "" : newValue)}
        >
          <SelectTrigger id={id} className="h-9">
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}...`} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option.value || "_empty_"} value={option.value || "_empty_"}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={id}
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="h-9"
        />
      )}
    </div>
  );
}