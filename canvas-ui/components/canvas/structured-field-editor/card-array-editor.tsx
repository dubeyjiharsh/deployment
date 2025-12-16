"use client";

/**
 * CardArrayEditor
 *
 * Editor for arrays of objects (cards).
 * Used for: Personas, Use Cases, Stakeholders, Success Criteria
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
  PERSONA_FIELD_LABELS,
  USE_CASE_FIELD_LABELS,
  SUCCESS_CRITERIA_FIELD_LABELS,
  STAKEHOLDER_LEVEL_LABELS,
  RACI_ROLE_LABELS,
  stakeholderLevels,
  raciRoles,
  type StakeholderLevel,
} from "@/lib/validators/structured-field-schemas";
import type { StructuredFieldEditorProps } from "./index";

type CardItem = Record<string, unknown>;

interface FieldConfig {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}

/**
 * Get field configuration for different card types
 */
function getFieldConfig(fieldKey: string): FieldConfig[] {
  switch (fieldKey) {
    case "personas":
      return [
        { key: "name", label: PERSONA_FIELD_LABELS.name, type: "text", required: true, placeholder: "e.g., Tech-Savvy Professional" },
        { key: "profile", label: PERSONA_FIELD_LABELS.profile, type: "textarea", placeholder: "Demographics and behavioral description..." },
        { key: "needs", label: PERSONA_FIELD_LABELS.needs, type: "textarea", placeholder: "What this persona requires..." },
        { key: "painPoints", label: PERSONA_FIELD_LABELS.painPoints, type: "textarea", placeholder: "Frustrations and challenges..." },
        { key: "successDefinition", label: PERSONA_FIELD_LABELS.successDefinition, type: "textarea", placeholder: "How success is measured..." },
      ];

    case "useCases":
      return [
        { key: "name", label: USE_CASE_FIELD_LABELS.name, type: "text", required: true, placeholder: "e.g., User Authentication Flow" },
        { key: "actor", label: USE_CASE_FIELD_LABELS.actor, type: "text", placeholder: "Who performs this action..." },
        { key: "goal", label: USE_CASE_FIELD_LABELS.goal, type: "textarea", placeholder: "What they want to achieve..." },
        { key: "scenario", label: USE_CASE_FIELD_LABELS.scenario, type: "textarea", placeholder: "Step-by-step description..." },
      ];

    case "stakeholderMap":
      return [
        { key: "name", label: "Name", type: "text", required: true, placeholder: "e.g., John Smith" },
        { key: "role", label: "Role", type: "text", placeholder: "e.g., Product Owner" },
        {
          key: "influence",
          label: "Influence",
          type: "select",
          options: stakeholderLevels.map(level => ({
            value: level,
            label: STAKEHOLDER_LEVEL_LABELS[level],
          })),
        },
        {
          key: "interest",
          label: "Interest",
          type: "select",
          options: stakeholderLevels.map(level => ({
            value: level,
            label: STAKEHOLDER_LEVEL_LABELS[level],
          })),
        },
        {
          key: "raciRole",
          label: "RACI Role",
          type: "select",
          options: [
            { value: "", label: "Not assigned" },
            ...raciRoles.map(role => ({
              value: role,
              label: RACI_ROLE_LABELS[role],
            })),
          ],
        },
      ];

    case "successCriteria":
      return [
        { key: "metric", label: SUCCESS_CRITERIA_FIELD_LABELS.metric, type: "text", required: true, placeholder: "e.g., User Adoption Rate" },
        { key: "target", label: SUCCESS_CRITERIA_FIELD_LABELS.target, type: "text", placeholder: "e.g., 70% within 3 months" },
        { key: "measurement", label: SUCCESS_CRITERIA_FIELD_LABELS.measurement, type: "textarea", placeholder: "How the metric will be calculated..." },
      ];

    default:
      // For unknown array types, derive fields from first item
      return [];
  }
}

/**
 * Get display title for a card item
 */
function getCardTitle(item: CardItem, fieldKey: string, index: number): string {
  const name = item.name || item.title || item.metric;
  if (typeof name === "string" && name.trim()) {
    return name;
  }

  // Fallback titles
  switch (fieldKey) {
    case "personas":
      return `Persona ${index + 1}`;
    case "useCases":
      return `Use Case ${index + 1}`;
    case "stakeholderMap":
      return `Stakeholder ${index + 1}`;
    case "successCriteria":
      return `Criterion ${index + 1}`;
    default:
      return `Item ${index + 1}`;
  }
}

/**
 * Create empty item for a field type
 */
function createEmptyItem(fieldKey: string): CardItem {
  switch (fieldKey) {
    case "personas":
      return { name: "", profile: "", needs: "", painPoints: "", successDefinition: "" };
    case "useCases":
      return { name: "", actor: "", goal: "", scenario: "" };
    case "stakeholderMap":
      return { name: "", role: "", influence: "medium" as StakeholderLevel, interest: "medium" as StakeholderLevel };
    case "successCriteria":
      return { metric: "", target: "", measurement: "" };
    default:
      return {};
  }
}

export function CardArrayEditor({
  fieldKey,
  value,
  onChange,
  onSave,
  onCancel,
  isSaving,
}: StructuredFieldEditorProps): React.ReactElement {
  // Normalize value to array
  const items: CardItem[] = React.useMemo(() => {
    if (Array.isArray(value)) {
      return value as CardItem[];
    }
    return [];
  }, [value]);

  // Use a ref to maintain stable keys for items across renders
  // This maps index to a stable key, and we update it when items change
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
    // Remove keys for indices that no longer exist
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
    onChange(newItems);
    // Expand the new card
    setExpandedCards(prev => new Set([...prev, newItems.length - 1]));
  };

  const handleUpdateItem = (index: number, updates: Partial<CardItem>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    onChange(newItems);
  };

  const handleDeleteItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
    // Update expanded cards indices
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
    onChange(newItems);
  };

  return (
    <div className="space-y-4">
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
                      {/* Drag handle */}
                      <div
                        className="cursor-grab opacity-30 group-hover:opacity-60"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </div>

                      {/* Expand/collapse indicator */}
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}

                      {/* Title */}
                      <span className="flex-1 truncate">{title}</span>

                      {/* Move buttons */}
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
                            <span className="text-xs">^</span>
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
                            <span className="text-xs rotate-180">^</span>
                          </Button>
                        </div>
                      )}

                      {/* Delete button */}
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
        Add {fieldKey === "personas" ? "Persona" :
              fieldKey === "useCases" ? "Use Case" :
              fieldKey === "stakeholderMap" ? "Stakeholder" :
              fieldKey === "successCriteria" ? "Criterion" : "Item"}
      </Button>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Changes"}
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
