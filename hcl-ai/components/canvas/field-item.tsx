"use client";

import * as React from "react";
import { ChevronDown, Sparkles, Check, X, Pencil, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { MermaidDiagram } from "@/components/ui/mermaid-diagram";
import {
  Item,
  ItemContent,
  ItemTitle,
} from "@/components/ui/item";
import { cn } from "@/lib/utils";
import { formatSourceName, getFieldLabel } from "@/lib/utils/canvas-helpers";
import type { CanvasField, BusinessCanvas } from "@/lib/validators/canvas-schema";

interface FieldItemProps {
  fieldKey: string;
  field: CanvasField<unknown>;
  renderValue: (value: unknown) => React.ReactNode;
  onRefine: (fieldKey: string) => void;
  onQuickEdit: (fieldKey: keyof BusinessCanvas, instruction: string) => Promise<unknown>;
  onAcceptEdit: (fieldKey: keyof BusinessCanvas, value: unknown) => Promise<void>;
  onOpenComments?: (fieldKey: string) => void;
  commentCount?: number;
  customDescription?: React.ReactNode;
  /** Callback to update user presence (e.g., when editing/refining) */
  onPresenceUpdate?: (update: { action?: "viewing" | "editing" | "refining"; activeField?: string | null }) => void;
  /** Effective access for the current user */
  access: "edit" | "read";
  /** Whether to show a quick generate action when empty */
  onGenerate?: (fieldKey: string) => void;
  /** Optional badge to show why access is restricted */
  accessLabel?: string | null;
}

export function FieldItem({
  fieldKey,
  field,
  renderValue,
  onRefine,
  onQuickEdit,
  onAcceptEdit,
  onOpenComments,
  commentCount = 0,
  customDescription,
  onPresenceUpdate,
  access,
  onGenerate,
  accessLabel,
}: FieldItemProps): React.ReactElement {
  const [isContentExpanded, setIsContentExpanded] = React.useState(false);
  const [isSourcesExpanded, setIsSourcesExpanded] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const fieldRef = React.useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
  const [instruction, setInstruction] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [previewValue, setPreviewValue] = React.useState<unknown | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState("");

  // Update presence when editing state changes
  React.useEffect(() => {
    if (isProcessing) {
      onPresenceUpdate?.({ action: "refining", activeField: fieldKey });
    } else if (isEditing) {
      onPresenceUpdate?.({ action: "editing", activeField: fieldKey });
    } else {
      // Only clear if we were previously editing this field
      onPresenceUpdate?.({ action: "viewing", activeField: null });
    }
  }, [isProcessing, isEditing, fieldKey, onPresenceUpdate]);

  const hasEvidence = field.evidence.length > 0;
  const hasPreview = previewValue !== null;

  React.useEffect(() => {
    const element = contentRef.current;
    if (element) {
      setIsTruncated(element.scrollHeight > element.clientHeight);
    }
  }, [field.value, customDescription]);

  const handleQuickEditSubmit = async () => {
    if (!instruction.trim()) return;

    setIsProcessing(true);
    setIsPopoverOpen(false);

    try {
      const newValue = await onQuickEdit(fieldKey as keyof BusinessCanvas, instruction);
      setPreviewValue(newValue);
    } catch (error) {
      console.error("Failed to process quick edit:", error);
      alert("Failed to process quick edit");
    } finally {
      setIsProcessing(false);
      setInstruction("");
    }
  };

  const handleAcceptEdit = async () => {
    if (previewValue === null) return;

    try {
      await onAcceptEdit(fieldKey as keyof BusinessCanvas, previewValue);
      setPreviewValue(null);
    } catch (error) {
      console.error("Failed to save changes:", error);
      alert("Failed to save changes");
    }
  };

  const handleDeclineEdit = () => {
    setPreviewValue(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleQuickEditSubmit();
    }
  };

  const handleStartEdit = () => {
    if (Array.isArray(field.value)) {
      const hasObjects = field.value.some((item) => typeof item === "object" && item !== null);
      // Show structured arrays as formatted JSON to avoid [object Object]
      setEditValue(hasObjects ? JSON.stringify(field.value, null, 2) : field.value.join("\n"));
      setIsEditing(true);
      return;
    }

    if (typeof field.value === "object" && field.value !== null) {
      setEditValue(JSON.stringify(field.value, null, 2));
      setIsEditing(true);
      return;
    }

    setEditValue(String(field.value || ""));
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    try {
      const tryParseJson = (input: string): unknown | null => {
        const trimmed = input.trim();
        if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
        try {
          return JSON.parse(trimmed);
        } catch {
          return null;
        }
      };

      let parsedValue: unknown = tryParseJson(editValue);

      if (parsedValue === null && Array.isArray(field.value)) {
        parsedValue = editValue
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line !== "");
      } else if (parsedValue === null && typeof field.value === "object" && field.value !== null) {
        parsedValue = editValue;
      } else if (parsedValue === null) {
        parsedValue = editValue;
      }

      await onAcceptEdit(fieldKey as keyof BusinessCanvas, parsedValue);
      setIsEditing(false);
      setEditValue("");
    } catch (error) {
      console.error("Failed to save changes:", error);
      alert("Failed to save changes");
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValue("");
  };

  const hasLowConfidence = field.confidence < 0.5;
  const isEditable = access === "edit";
  const isEmpty = !field.value || (typeof field.value === "string" && field.value.trim() === "");

  return (
    <Item
      ref={fieldRef}
      data-field-key={fieldKey}
      variant="outline"
      className={cn(
        "transition-all items-start break-inside-avoid mb-2 border-0",
        hasLowConfidence && "border-destructive/30 bg-destructive/5",
        hasPreview && "ring-2 ring-primary/50"
      )}
      style={{ backgroundColor: "var(--canvas-card-bg)" }}
    >
      <ItemContent>
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex items-center gap-2 flex-1">
            <ItemTitle className="text-base font-semibold text-primary">
              {getFieldLabel(fieldKey)}
            </ItemTitle>
            {hasLowConfidence && (
              <Badge variant="destructive" className="text-xs">
                {Math.round(field.confidence * 100)}% confidence
              </Badge>
            )}
            {access === "read" && (
              <Badge variant="secondary" className="text-xs">
                Read-only
              </Badge>
            )}
            {accessLabel && (
              <Badge variant="outline" className="text-xs">
                {accessLabel}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasPreview || isEditing ? (
              <ButtonGroup>
                <Button
                  size="sm"
                  variant="default"
                  onClick={isEditing ? handleSaveEdit : handleAcceptEdit}
                  className="h-7 px-2"
                >
                  <Check className="h-3 w-3" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={isEditing ? handleCancelEdit : handleDeclineEdit}
                  className="h-7 px-2"
                >
                  <X className="h-3 w-3" />
                  Decline
                </Button>
              </ButtonGroup>
            ) : (
              <ButtonGroup>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onPresenceUpdate?.({ action: "refining", activeField: fieldKey });
                    onRefine(fieldKey);
                  }}
                  className="h-7 px-2"
                  disabled={!isEditable}
                >
                  Refine
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartEdit}
                  className="h-7 px-2"
                  aria-label="Edit"
                  disabled={!isEditable}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
                {isEditable && (
                  <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2"
                        aria-label="Quick Edit"
                      >
                        <Sparkles className="h-3 w-3" />
                        Quick Edit
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="rounded-xl p-0 text-sm w-80">
                      <div className="px-4 py-3">
                        <div className="text-sm font-medium">Quick Edit</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Describe how you&apos;d like to improve this field
                        </div>
                      </div>
                      <Separator />
                      <div className="p-4">
                        <Textarea
                          placeholder="E.g., Make it more concise, add more details..."
                          value={instruction}
                          onChange={(e) => setInstruction(e.target.value)}
                          onKeyDown={handleKeyDown}
                          className="mb-3 resize-none min-h-20"
                        />
                        <Button
                          size="sm"
                          onClick={handleQuickEditSubmit}
                          disabled={!instruction.trim()}
                          className="w-full"
                        >
                          <Sparkles className="h-3 w-3" />
                          Apply Changes
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                {onOpenComments && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenComments(fieldKey)}
                    className="h-7 px-2 relative"
                    aria-label="Comments"
                  >
                    <MessageCircle className="h-3 w-3" />
                    {commentCount > 0 && (
                      <Badge
                        variant="default"
                        className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-xs"
                      >
                        {commentCount}
                      </Badge>
                    )}
                  </Button>
                )}
              </ButtonGroup>
            )}
          </div>
        </div>
        <div className="w-full">
          {isProcessing ? (
            <div className="space-y-2 mt-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : isEditing ? (
            <div className="mt-2">
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="min-h-32 resize-y font-mono text-sm"
                placeholder="Enter field content..."
              />
            </div>
          ) : (
            <>
              {isEmpty && isEditable && onGenerate && (
                <div className="mb-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => onGenerate(fieldKey)}
                  >
                    <Sparkles className="h-3 w-3 mr-2" />
                    Generate for my team
                  </Button>
                </div>
              )}
              <div
                ref={contentRef}
                className={cn(
                  "text-sm text-muted-foreground mt-2 leading-relaxed",
                  !isContentExpanded && "line-clamp-3",
                  hasPreview && "rounded-lg bg-primary/5 p-3 border border-primary/20"
                )}
              >
                {customDescription || renderValue(hasPreview ? previewValue : field.value)}
              </div>

              {field.diagram && (
                <div className="mt-4">
                  <MermaidDiagram chart={field.diagram} className="w-full" />
                </div>
              )}

              {isTruncated && !isContentExpanded && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsContentExpanded(true);
                  }}
                  className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <span>Show more</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              )}
              {isContentExpanded && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsContentExpanded(false);
                  }}
                  className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <span>Show less</span>
                  <ChevronDown className="h-3.5 w-3.5 rotate-180" />
                </button>
              )}
            </>
          )}
          {hasEvidence && (
            <div className="mt-3 pt-3 border-t">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSourcesExpanded(!isSourcesExpanded);
                }}
                className="group flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform group-hover:text-primary",
                    isSourcesExpanded && "rotate-180"
                  )}
                />
                <span>View {field.evidence.length} source{field.evidence.length !== 1 && "s"}</span>
              </button>

              {isSourcesExpanded && (
                <div className="mt-3 space-y-2">
                  {field.evidence.map((evidence, index) => (
                    <div
                      key={index}
                      className="group/evidence relative rounded-lg bg-muted/30 border border-border/50 p-3 space-y-2 hover:bg-muted/50 hover:border-border transition-all"
                    >
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                          {Math.round(evidence.confidence * 100)}%
                        </Badge>
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed pr-16">
                        &quot;{evidence.snippet}&quot;
                      </p>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-medium text-primary">
                          {formatSourceName(evidence.source)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </ItemContent>
    </Item>
  );
}
