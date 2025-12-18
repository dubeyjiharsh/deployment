"use client";

/**
 * BudgetEditor
 *
 * Editor for budget/resources fields with total, breakdown, and FTE.
 * Used for: Budget & Resources
 *
 * UI: Total estimate input, breakdown table, FTE requirements
 */

import * as React from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BUDGET_BREAKDOWN_FIELD_LABELS,
  type BudgetResourcesValue,
  type BudgetBreakdownValue,
} from "@/lib/validators/structured-field-schemas";
import type { StructuredFieldEditorProps } from "./index";

/**
 * Normalizes value to BudgetResourcesValue shape
 */
function normalizeBudget(value: unknown): BudgetResourcesValue {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    return {
      totalEstimate: String(v.totalEstimate || ""),
      breakdown: Array.isArray(v.breakdown)
        ? v.breakdown.map(normalizeBreakdown)
        : [],
      fteRequirements: v.fteRequirements ? String(v.fteRequirements) : undefined,
    };
  }
  return { totalEstimate: "", breakdown: [] };
}

function normalizeBreakdown(b: unknown): BudgetBreakdownValue {
  if (typeof b === "object" && b !== null) {
    const breakdown = b as Record<string, unknown>;
    return {
      category: String(breakdown.category || ""),
      amount: String(breakdown.amount || ""),
      notes: breakdown.notes ? String(breakdown.notes) : undefined,
    };
  }
  return { category: "", amount: "" };
}

function createEmptyBreakdown(): BudgetBreakdownValue {
  return { category: "", amount: "" };
}

export function BudgetEditor({
  value,
  onChange,
  onSave,
  onCancel,
  isSaving,
}: StructuredFieldEditorProps): React.ReactElement {
  const budget = React.useMemo(() => normalizeBudget(value), [value]);

  const handleTotalChange = (totalEstimate: string) => {
    onChange({ ...budget, totalEstimate });
  };

  const handleFteChange = (fteRequirements: string) => {
    onChange({
      ...budget,
      fteRequirements: fteRequirements || undefined,
    });
  };

  const handleAddBreakdown = () => {
    onChange({
      ...budget,
      breakdown: [...budget.breakdown, createEmptyBreakdown()],
    });
  };

  const handleUpdateBreakdown = (index: number, updates: Partial<BudgetBreakdownValue>) => {
    const newBreakdown = [...budget.breakdown];
    newBreakdown[index] = { ...newBreakdown[index], ...updates };
    onChange({ ...budget, breakdown: newBreakdown });
  };

  const handleDeleteBreakdown = (index: number) => {
    onChange({
      ...budget,
      breakdown: budget.breakdown.filter((_, i) => i !== index),
    });
  };

  const handleMoveBreakdown = (fromIndex: number, toIndex: number) => {
    const newBreakdown = [...budget.breakdown];
    const [removed] = newBreakdown.splice(fromIndex, 1);
    newBreakdown.splice(toIndex, 0, removed);
    onChange({ ...budget, breakdown: newBreakdown });
  };

  return (
    <div className="space-y-6">
      {/* Total Estimate */}
      <div className="space-y-2">
        <Label htmlFor="total-estimate" className="text-sm font-medium">
          Total Estimate
        </Label>
        <Input
          id="total-estimate"
          value={budget.totalEstimate}
          onChange={(e) => handleTotalChange(e.target.value)}
          placeholder="e.g., $500K"
          className="h-10"
        />
        <p className="text-xs text-muted-foreground">
          The total estimated budget for this project
        </p>
      </div>

      {/* Breakdown */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span>Budget Breakdown</span>
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {budget.breakdown.length} {budget.breakdown.length === 1 ? "item" : "items"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-4 px-4">
          <div className="space-y-3">
            {/* Header row */}
            {budget.breakdown.length > 0 && (
              <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-8">
                <div className="col-span-4">{BUDGET_BREAKDOWN_FIELD_LABELS.category}</div>
                <div className="col-span-3">{BUDGET_BREAKDOWN_FIELD_LABELS.amount}</div>
                <div className="col-span-5">{BUDGET_BREAKDOWN_FIELD_LABELS.notes}</div>
              </div>
            )}

            {/* Breakdown items */}
            {budget.breakdown.map((item, index) => (
              <BreakdownRow
                key={index}
                item={item}
                index={index}
                totalCount={budget.breakdown.length}
                onChange={(updates) => handleUpdateBreakdown(index, updates)}
                onDelete={() => handleDeleteBreakdown(index)}
                onMoveUp={() => index > 0 && handleMoveBreakdown(index, index - 1)}
                onMoveDown={() =>
                  index < budget.breakdown.length - 1 &&
                  handleMoveBreakdown(index, index + 1)
                }
              />
            ))}

            {budget.breakdown.length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                No breakdown items yet. Add categories to detail your budget.
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddBreakdown}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Budget Category
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* FTE Requirements */}
      <div className="space-y-2">
        <Label htmlFor="fte-requirements" className="text-sm font-medium">
          FTE Requirements (optional)
        </Label>
        <Textarea
          id="fte-requirements"
          value={budget.fteRequirements || ""}
          onChange={(e) => handleFteChange(e.target.value)}
          placeholder="e.g., 5 engineers, 2 designers, 1 PM"
          className="min-h-[80px] resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Full-time equivalent staffing requirements
        </p>
      </div>

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
 * Individual breakdown row component
 */
interface BreakdownRowProps {
  item: BudgetBreakdownValue;
  index: number;
  totalCount: number;
  onChange: (updates: Partial<BudgetBreakdownValue>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function BreakdownRow({
  item,
  index,
  totalCount,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: BreakdownRowProps): React.ReactElement {
  return (
    <div className="group flex items-start gap-2">
      {/* Drag handle */}
      <div className="flex flex-col items-center gap-0.5 pt-2">
        <div className="cursor-grab opacity-30 group-hover:opacity-60">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        {totalCount > 1 && (
          <>
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
          </>
        )}
      </div>

      {/* Fields */}
      <div className="flex-1 grid grid-cols-12 gap-2">
        <div className="col-span-4">
          <Input
            value={item.category}
            onChange={(e) => onChange({ category: e.target.value })}
            placeholder="e.g., Development"
            className="h-9"
          />
        </div>
        <div className="col-span-3">
          <Input
            value={item.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
            placeholder="e.g., $300K"
            className="h-9"
          />
        </div>
        <div className="col-span-5">
          <Input
            value={item.notes || ""}
            onChange={(e) => onChange({ notes: e.target.value || undefined })}
            placeholder="Optional notes..."
            className="h-9"
          />
        </div>
      </div>

      {/* Delete button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="h-9 w-9 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
        aria-label="Delete item"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
