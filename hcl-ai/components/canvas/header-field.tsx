"use client";

import * as React from "react";
import { ChevronDown, Sparkles, Check, X, Pencil, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatSourceName } from "@/lib/utils/canvas-helpers";
import type { CanvasField } from "@/lib/validators/canvas-schema";

interface HeaderFieldProps {
  fieldKey: string;
  field: CanvasField<unknown>;
  isTitle?: boolean;
  commentCount?: number;
  onEditField: (fieldName: string) => void;
  onQuickEdit: (instruction: string) => Promise<unknown>;
  onSaveCanvas: (newValue: unknown) => Promise<void>;
  onOpenComments?: (fieldKey: string) => void;
}

/**
 * Renders a header field (title or problem statement) with editing capabilities
 */
export function HeaderField({
  fieldKey,
  field,
  isTitle = false,
  commentCount = 0,
  onEditField,
  onQuickEdit,
  onSaveCanvas,
  onOpenComments,
}: HeaderFieldProps): React.ReactElement {
  const [isSourcesExpanded, setIsSourcesExpanded] = React.useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
  const [instruction, setInstruction] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [previewValue, setPreviewValue] = React.useState<unknown | null>(null);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState("");

  const hasEvidence = field.evidence.length > 0;
  const hasPreview = previewValue !== null;

  const handleQuickEditSubmit = async () => {
    if (!instruction.trim()) return;

    setIsProcessing(true);
    setIsPopoverOpen(false);

    try {
      const newValue = await onQuickEdit(instruction);
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
      await onSaveCanvas(previewValue);
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
    setEditValue(String(field.value || ""));
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    try {
      await onSaveCanvas(editValue);
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

  return (
    <div
      className="group/header relative mb-6"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1">
          {isEditing ? (
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className={cn(
                "resize-y font-sans",
                isTitle ? "text-3xl font-bold min-h-20" : "text-lg min-h-24"
              )}
              placeholder="Enter content..."
            />
          ) : isTitle ? (
            <h1 className={cn(
              "text-3xl font-bold tracking-tight transition-colors text-primary",
              hasPreview && "text-primary"
            )}>
              {isProcessing ? (
                <Skeleton className="h-10 w-3/4" />
              ) : (
                hasPreview ? String(previewValue) : String(field.value)
              )}
            </h1>
          ) : (
            <p className={cn(
              "text-lg text-muted-foreground leading-relaxed",
              hasPreview && "text-foreground font-medium"
            )}>
              {isProcessing ? (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-5/6" />
                </div>
              ) : (
                hasPreview ? String(previewValue) : String(field.value)
              )}
            </p>
          )}

          {hasEvidence && (
            <div className="mt-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSourcesExpanded(!isSourcesExpanded);
                }}
                className="group/sources flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform group-hover/sources:text-primary",
                    isSourcesExpanded && "rotate-180"
                  )}
                />
                <span>View {field.evidence.length} source{field.evidence.length !== 1 && "s"}</span>
              </button>

              {isSourcesExpanded && (
                <div className="mt-3 space-y-2 max-w-3xl">
                  {field.evidence.map((evidence, index) => (
                    <div
                      key={index}
                      className="relative rounded-lg bg-muted/30 border border-border/50 p-3 space-y-2 hover:bg-muted/50 hover:border-border transition-all"
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

        <div className={cn(
          "flex items-center gap-2 transition-opacity duration-200",
          isHovered || hasPreview || isEditing || isPopoverOpen ? "opacity-100" : "opacity-0"
        )}>
          {hasPreview || isEditing ? (
            <ButtonGroup>
              <Button
                size="sm"
                variant="default"
                onClick={isEditing ? handleSaveEdit : handleAcceptEdit}
              >
                <Check className="h-4 w-4" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={isEditing ? handleCancelEdit : handleDeclineEdit}
              >
                <X className="h-4 w-4" />
                Decline
              </Button>
            </ButtonGroup>
          ) : (
            <ButtonGroup>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditField(fieldKey)}
              >
                Refine
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStartEdit}
                aria-label="Edit"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Quick Edit"
                  >
                    <Sparkles className="h-4 w-4" />
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
              {onOpenComments && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenComments(fieldKey)}
                  className="relative"
                  aria-label="Comments"
                >
                  <MessageCircle className="h-4 w-4" />
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
    </div>
  );
}
