"use client";

import * as React from "react";
import { Sparkles, Plus, X, Eye, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Story } from "@/stores/canvas-store";

interface SuggestionCardProps {
  suggestion: Story;
  onAdd: (suggestion: Story) => void;
  onDismiss?: (id: string) => void;
  onPreview?: (suggestion: Story) => void;
  isAdding?: boolean;
  isAddedToCanvas?: boolean;
}

export function SuggestionCard({
  suggestion,
  onAdd,
  onDismiss,
  onPreview,
  isAdding,
  isAddedToCanvas,
}: SuggestionCardProps) {
  return (
    <div
      className={cn(
        "group relative border-2 border-dashed rounded-lg p-4 bg-muted/30 transition-all",
        isAddedToCanvas
          ? "border-green-300 bg-green-50/50 opacity-60"
          : "hover:border-primary/50 hover:bg-muted/50"
      )}
    >
      {/* AI indicator or Added indicator */}
      <div className="absolute -top-2 -right-2">
        {isAddedToCanvas ? (
          <div className="flex items-center justify-center h-5 w-5 rounded-full bg-green-100 border border-green-300">
            <Check className="h-3 w-3 text-green-600" />
          </div>
        ) : (
          <div className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 border border-primary/20">
            <Sparkles className="h-3 w-3 text-primary" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <h4 className="font-medium text-sm flex-1">{suggestion.title}</h4>
          {suggestion.priority && (
            <Badge
              variant={
                suggestion.priority === "high"
                  ? "destructive"
                  : suggestion.priority === "medium"
                  ? "default"
                  : "secondary"
              }
              className="text-xs shrink-0"
            >
              {suggestion.priority}
            </Badge>
          )}
        </div>

        {suggestion.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {suggestion.description}
          </p>
        )}

        {/* Story points */}
        {suggestion.storyPoints && (
          <div className="text-xs text-muted-foreground">
            Est. {suggestion.storyPoints} story points
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-dashed">
        {isAddedToCanvas ? (
          <div className="flex-1 flex items-center justify-center gap-2 py-1.5 text-sm text-green-600 font-medium">
            <Check className="h-4 w-4" />
            Added to Board
          </div>
        ) : (
          <>
            <Button
              size="sm"
              onClick={() => onAdd(suggestion)}
              disabled={isAdding}
              className="flex-1"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add to Board
            </Button>
            {onPreview && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPreview(suggestion)}
              >
                <Eye className="h-3 w-3" />
              </Button>
            )}
            {onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDismiss(suggestion.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
