"use client";

/**
 * CategoryListEditor
 *
 * Editor for fields that are objects with category keys, each containing string arrays.
 * Used for: Non-Functional Requirements
 *
 * UI: Collapsible sections with headers, each containing a list of editable items
 */

import * as React from "react";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  NFR_CATEGORY_LABELS,
  SCOPE_CATEGORY_LABELS,
  nfrCategoryKeys,
} from "@/lib/validators/structured-field-schemas";
import type { StructuredFieldEditorProps } from "./index";

type CategoryValue = Record<string, string[]>;

interface CategoryConfig {
  key: string;
  label: string;
}

/**
 * Gets category configuration based on field key
 */
function getCategoryConfig(fieldKey: string): CategoryConfig[] {
  switch (fieldKey) {
    case "nonFunctionalRequirements":
      return nfrCategoryKeys.map(key => ({
        key,
        label: NFR_CATEGORY_LABELS[key],
      }));

    case "scopeDefinition":
      return [
        { key: "inScope", label: SCOPE_CATEGORY_LABELS.inScope },
        { key: "outOfScope", label: SCOPE_CATEGORY_LABELS.outOfScope },
      ];

    default:
      // For unknown objects, use the keys as labels
      return [];
  }
}

export function CategoryListEditor({
  fieldKey,
  value,
  onChange,
  onSave,
  onCancel,
  isSaving,
}: StructuredFieldEditorProps): React.ReactElement {
  // Normalize value to expected shape
  const categoryValue = React.useMemo((): CategoryValue => {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as CategoryValue;
    }
    return {};
  }, [value]);

  // Get category configuration
  const categories = React.useMemo(() => {
    const config = getCategoryConfig(fieldKey);
    if (config.length > 0) return config;

    // Fallback: derive from value keys
    return Object.keys(categoryValue).map(key => ({
      key,
      label: key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase()),
    }));
  }, [fieldKey, categoryValue]);

  // Track which categories are expanded
  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(
    new Set(categories.map(c => c.key))
  );

  // Track editing states
  const [editingItem, setEditingItem] = React.useState<{ category: string; index: number } | null>(null);
  const [newItemText, setNewItemText] = React.useState<Record<string, string>>({});

  const toggleCategory = (key: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleAddItem = (categoryKey: string) => {
    const text = newItemText[categoryKey]?.trim();
    if (!text) return;

    const currentItems = categoryValue[categoryKey] || [];
    const newValue = {
      ...categoryValue,
      [categoryKey]: [...currentItems, text],
    };

    onChange(newValue);
    setNewItemText(prev => ({ ...prev, [categoryKey]: "" }));
  };

  const handleUpdateItem = (categoryKey: string, index: number, newText: string) => {
    const currentItems = categoryValue[categoryKey] || [];
    const newItems = [...currentItems];
    newItems[index] = newText;

    onChange({
      ...categoryValue,
      [categoryKey]: newItems,
    });
  };

  const handleDeleteItem = (categoryKey: string, index: number) => {
    const currentItems = categoryValue[categoryKey] || [];
    const newItems = currentItems.filter((_, i) => i !== index);

    onChange({
      ...categoryValue,
      [categoryKey]: newItems,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent, categoryKey: string) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddItem(categoryKey);
    }
  };

  return (
    <div className="space-y-4">
      {categories.map(({ key, label }) => {
        const items = categoryValue[key] || [];
        const isExpanded = expandedCategories.has(key);
        const itemCount = items.length;

        return (
          <Collapsible
            key={key}
            open={isExpanded}
            onOpenChange={() => toggleCategory(key)}
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
                      {itemCount} {itemCount === 1 ? "item" : "items"}
                    </span>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0 pb-4 px-4">
                  <div className="space-y-2">
                    {/* Existing items */}
                    {items.map((item, index) => (
                      <CategoryItem
                        key={`${key}-${index}-${item.slice(0, 30)}`}
                        text={item}
                        isEditing={
                          editingItem?.category === key && editingItem?.index === index
                        }
                        onStartEdit={() => setEditingItem({ category: key, index })}
                        onFinishEdit={() => setEditingItem(null)}
                        onChange={(newText) => handleUpdateItem(key, index, newText)}
                        onDelete={() => handleDeleteItem(key, index)}
                      />
                    ))}

                    {/* Add new item */}
                    <div className="flex items-center gap-2 mt-3">
                      <Input
                        value={newItemText[key] || ""}
                        onChange={(e) =>
                          setNewItemText(prev => ({ ...prev, [key]: e.target.value }))
                        }
                        onKeyDown={(e) => handleKeyDown(e, key)}
                        placeholder={`Add new ${label.toLowerCase()} item...`}
                        className="flex-1 h-9 text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddItem(key)}
                        disabled={!newItemText[key]?.trim()}
                        className="h-9 px-3"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
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
 * Individual category item component
 */
interface CategoryItemProps {
  text: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onFinishEdit: () => void;
  onChange: (newText: string) => void;
  onDelete: () => void;
}

function CategoryItem({
  text,
  isEditing,
  onStartEdit,
  onFinishEdit,
  onChange,
  onDelete,
}: CategoryItemProps): React.ReactElement {
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

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 group">
        <div className="w-6 flex-shrink-0" />
        <Input
          ref={inputRef}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="flex-1 h-8 text-sm"
        />
        <div className="w-8 flex-shrink-0" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 group rounded-md",
        "hover:bg-muted/50 transition-colors",
        "pr-1"
      )}
    >
      <div className="w-6 flex-shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-50 cursor-grab">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

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

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
        aria-label="Delete item"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
