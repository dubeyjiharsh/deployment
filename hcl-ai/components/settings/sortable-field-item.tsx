"use client";

import * as React from "react";
import { GripVertical, Lock, Code, Settings2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FieldConfiguration } from "@/lib/validators/settings-schema";

interface SortableFieldItemProps {
  field: FieldConfiguration;
  onToggle: () => void;
  onEdit: () => void;
  isSaving: boolean;
  onReset?: () => void;
  canReset?: boolean;
}

export function SortableFieldItem({
  field,
  onToggle,
  onEdit,
  isSaving,
  onReset,
  canReset = false,
}: SortableFieldItemProps): React.ReactElement {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id, disabled: field.isRequired });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-3 rounded-md border bg-card p-3 hover:bg-accent/5 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          disabled={field.isRequired}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>

        {field.isRequired ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted/50" title="Required Field">
            <Lock className="h-4 w-4 text-muted-foreground/70" />
          </div>
        ) : (
          <Switch
            checked={field.enabled}
            onCheckedChange={onToggle}
            disabled={isSaving}
            className="scale-90"
          />
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-2">
          <span className={`font-medium text-sm ${!field.enabled ? "text-muted-foreground line-through decoration-muted-foreground/50" : ""}`}>
            {field.name}
          </span>
          <div className="flex items-center gap-1.5">
            {field.type === "custom" && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal border-blue-200 bg-blue-50 text-blue-700">
                Custom
              </Badge>
            )}
            {field.supportsDiagram && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal border-indigo-200 bg-indigo-50 text-indigo-700">
                Diagram
              </Badge>
            )}
          </div>
        </div>
        {field.description && (
          <p className="text-xs text-muted-foreground truncate max-w-[90%] mt-0.5">
            {field.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground mr-2">
        <div className="hidden sm:flex items-center gap-1.5 bg-muted/30 px-2 py-1 rounded">
          <Code className="h-3 w-3" />
          <span className="capitalize">{field.valueType}</span>
        </div>
        {canReset && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onReset}
            disabled={isSaving}
            title="Reset to default"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={onEdit}
          disabled={isSaving}
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
