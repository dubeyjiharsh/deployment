"use client";

/**
 * GovernanceEditor
 *
 * Editor for governance fields with approvers and reviewers sections.
 * Used for: Governance
 *
 * UI: Two collapsible sections, each with cards for people
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
  GOVERNANCE_CATEGORY_LABELS,
  GOVERNANCE_PERSON_FIELD_LABELS,
  type GovernanceValue,
  type GovernancePersonValue,
} from "@/lib/validators/structured-field-schemas";
import type { StructuredFieldEditorProps } from "./index";

type GovernanceCategory = "approvers" | "reviewers";

/**
 * Normalizes value to GovernanceValue shape
 */
function normalizeGovernance(value: unknown): GovernanceValue {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    return {
      approvers: Array.isArray(v.approvers)
        ? v.approvers.map(normalizeGovPerson)
        : [],
      reviewers: Array.isArray(v.reviewers)
        ? v.reviewers.map(normalizeGovPerson)
        : [],
    };
  }
  return { approvers: [], reviewers: [] };
}

function normalizeGovPerson(p: unknown): GovernancePersonValue {
  if (typeof p === "object" && p !== null) {
    const person = p as Record<string, unknown>;
    return {
      role: String(person.role || ""),
      responsibility: String(person.responsibility || ""),
      authority: String(person.authority || ""),
    };
  }
  return { role: "", responsibility: "", authority: "" };
}

function createEmptyPerson(): GovernancePersonValue {
  return { role: "", responsibility: "", authority: "" };
}

export function GovernanceEditor({
  value,
  onChange,
  onSave,
  onCancel,
  isSaving,
}: StructuredFieldEditorProps): React.ReactElement {
  const governance = React.useMemo(() => normalizeGovernance(value), [value]);

  const [expandedCategories, setExpandedCategories] = React.useState<Set<GovernanceCategory>>(
    new Set(["approvers", "reviewers"])
  );

  const toggleCategory = (category: GovernanceCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleAddPerson = (category: GovernanceCategory) => {
    const newPerson = createEmptyPerson();
    onChange({
      ...governance,
      [category]: [...governance[category], newPerson],
    });
  };

  const handleUpdatePerson = (
    category: GovernanceCategory,
    index: number,
    updates: Partial<GovernancePersonValue>
  ) => {
    const newList = [...governance[category]];
    newList[index] = { ...newList[index], ...updates };
    onChange({
      ...governance,
      [category]: newList,
    });
  };

  const handleDeletePerson = (category: GovernanceCategory, index: number) => {
    onChange({
      ...governance,
      [category]: governance[category].filter((_, i) => i !== index),
    });
  };

  const handleMovePerson = (
    category: GovernanceCategory,
    fromIndex: number,
    toIndex: number
  ) => {
    const newList = [...governance[category]];
    const [removed] = newList.splice(fromIndex, 1);
    newList.splice(toIndex, 0, removed);
    onChange({
      ...governance,
      [category]: newList,
    });
  };

  const categories: GovernanceCategory[] = ["approvers", "reviewers"];

  return (
    <div className="space-y-4">
      {categories.map((category) => {
        const people = governance[category];
        const isExpanded = expandedCategories.has(category);
        const label = GOVERNANCE_CATEGORY_LABELS[category];

        return (
          <Collapsible
            key={category}
            open={isExpanded}
            onOpenChange={() => toggleCategory(category)}
          >
            <Card className="border shadow-sm">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3 px-4">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      {label}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {people.length} {people.length === 1 ? "person" : "people"}
                    </span>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0 pb-4 px-4">
                  <div className="space-y-3">
                    {people.map((person, index) => (
                      <GovernancePersonCard
                        key={index}
                        person={person}
                        index={index}
                        totalCount={people.length}
                        onChange={(updates) => handleUpdatePerson(category, index, updates)}
                        onDelete={() => handleDeletePerson(category, index)}
                        onMoveUp={() =>
                          index > 0 && handleMovePerson(category, index, index - 1)
                        }
                        onMoveDown={() =>
                          index < people.length - 1 &&
                          handleMovePerson(category, index, index + 1)
                        }
                      />
                    ))}

                    {people.length === 0 && (
                      <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                        No {label.toLowerCase()} yet.
                      </div>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddPerson(category)}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add {category === "approvers" ? "Approver" : "Reviewer"}
                    </Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

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
 * Individual governance person card
 */
interface GovernancePersonCardProps {
  person: GovernancePersonValue;
  index: number;
  totalCount: number;
  onChange: (updates: Partial<GovernancePersonValue>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function GovernancePersonCard({
  person,
  index,
  totalCount,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: GovernancePersonCardProps): React.ReactElement {
  return (
    <div className="group relative border rounded-lg p-3 bg-card hover:shadow-sm transition-shadow">
      <div className="flex gap-3">
        {/* Drag handle and move buttons */}
        <div className="flex flex-col items-center gap-1 pt-1">
          <div className="cursor-grab opacity-30 group-hover:opacity-60">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          {totalCount > 1 && (
            <div className="flex flex-col gap-0.5">
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
        </div>

        {/* Form fields */}
        <div className="flex-1 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`role-${index}`} className="text-xs text-muted-foreground">
              {GOVERNANCE_PERSON_FIELD_LABELS.role}
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Input
              id={`role-${index}`}
              value={person.role}
              onChange={(e) => onChange({ role: e.target.value })}
              placeholder="e.g., Digital Product Director"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`responsibility-${index}`} className="text-xs text-muted-foreground">
              {GOVERNANCE_PERSON_FIELD_LABELS.responsibility}
            </Label>
            <Textarea
              id={`responsibility-${index}`}
              value={person.responsibility}
              onChange={(e) => onChange({ responsibility: e.target.value })}
              placeholder="What they oversee..."
              className="min-h-[50px] resize-none text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`authority-${index}`} className="text-xs text-muted-foreground">
              {GOVERNANCE_PERSON_FIELD_LABELS.authority}
            </Label>
            <Textarea
              id={`authority-${index}`}
              value={person.authority}
              onChange={(e) => onChange({ authority: e.target.value })}
              placeholder="What they have final say on..."
              className="min-h-[50px] resize-none text-sm"
            />
          </div>
        </div>

        {/* Delete button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
          aria-label="Delete person"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
