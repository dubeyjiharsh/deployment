"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Target, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Story } from "@/stores/canvas-store";
import { SuggestionCard } from "./SuggestionCard";

interface SuggestionGroupProps {
  title: string;
  description?: string;
  type: "okr" | "requirement";
  suggestions: Story[];
  onAdd: (suggestion: Story) => void;
  onDismiss?: (id: string) => void;
  defaultExpanded?: boolean;
}

export function SuggestionGroup({
  title,
  description,
  type,
  suggestions,
  onAdd,
  onDismiss,
  defaultExpanded = true,
}: SuggestionGroupProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const Icon = type === "okr" ? Target : FileText;

  if (suggestions.length === 0) return null;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Group header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center gap-3 p-3 text-left transition-colors",
          "hover:bg-muted/50",
          isExpanded && "bg-muted/30 border-b"
        )}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}

        <Icon className="h-4 w-4 text-primary shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{title}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              ({suggestions.length})
            </span>
          </div>
          {description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {description}
            </p>
          )}
        </div>
      </button>

      {/* Suggestions */}
      {isExpanded && (
        <div className="p-3 space-y-3 bg-background">
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onAdd={onAdd}
              onDismiss={onDismiss}
            />
          ))}
        </div>
      )}
    </div>
  );
}
