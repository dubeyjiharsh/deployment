"use client";

import * as React from "react";
import { Sparkles, ChevronDown, AlertCircle, Check, X, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatSourceName } from "@/lib/utils/canvas-helpers";
import { MermaidDiagram } from "@/components/ui/mermaid-diagram";
import type { CanvasField } from "@/lib/validators/canvas-schema";

interface CanvasCardProps<T> {
  title: string;
  field: CanvasField<T>;
  onEdit: () => void;
  onQuickEdit?: (instruction: string) => Promise<T>;
  onAcceptEdit?: (value: T) => Promise<void>;
  onProvideContext?: (context: string) => Promise<T>;
  renderValue: (value: T) => React.ReactNode;
  className?: string;
}

/**
 * Displays a canvas field as a card with confidence indicator and evidence
 */
export function CanvasCard<T>({
  title,
  field,
  onEdit,
  onQuickEdit,
  onAcceptEdit,
  onProvideContext,
  renderValue,
  className,
}: CanvasCardProps<T>): React.ReactElement {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
  const [instruction, setInstruction] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [previewValue, setPreviewValue] = React.useState<T | null>(null);
  const [isProvidingContext, setIsProvidingContext] = React.useState(false);
  const [contextInput, setContextInput] = React.useState("");

  const hasLowConfidence = field.confidence < 0.5;
  const hasEvidence = field.evidence.length > 0;
  const hasPreview = previewValue !== null;
  const isInsufficientContext = field.state === "insufficient_context";

  const handleQuickEdit = async () => {
    if (!instruction.trim() || !onQuickEdit) return;

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

  const handleAccept = async () => {
    if (previewValue !== null && onAcceptEdit) {
      setIsProcessing(true);
      try {
        await onAcceptEdit(previewValue);
        setPreviewValue(null);
      } catch (error) {
        console.error("Failed to save changes:", error);
        alert("Failed to save changes");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleDecline = () => {
    setPreviewValue(null);
  };

  const handleProvideContext = async () => {
    if (!contextInput.trim() || !onProvideContext) return;

    setIsProcessing(true);
    try {
      const newValue = await onProvideContext(contextInput);
      setPreviewValue(newValue);
      setContextInput("");
      setIsProvidingContext(false);
    } catch (error) {
      console.error("Failed to regenerate with context:", error);
      alert("Failed to regenerate field with context");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleQuickEdit();
    }
  };

  const handleContextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleProvideContext();
    }
  };

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-300 hover:shadow-lg",
        hasLowConfidence && !isInsufficientContext && "border-destructive/30 bg-destructive/5",
        isInsufficientContext && "border-amber-300 bg-amber-50/50",
        hasPreview && "ring-2 ring-primary/50",
        className
      )}
    >
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-lg font-semibold tracking-tight">{title}</CardTitle>
            {isInsufficientContext ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs border-amber-400 text-amber-700 bg-amber-100">
                  {Math.round(field.confidence * 100)}% confidence
                </Badge>
                <div className="flex items-center gap-1 text-xs text-amber-700">
                  <AlertCircle className="h-3 w-3" />
                  <span>Insufficient context</span>
                </div>
              </div>
            ) : hasLowConfidence && (
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="text-xs">
                  {Math.round(field.confidence * 100)}% confidence
                </Badge>
                <div className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>Low confidence</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasPreview ? (
              <ButtonGroup>
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleAccept}
                  className="h-8 px-3"
                >
                  <Check className="h-4 w-4" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDecline}
                  className="h-8 px-3"
                >
                  <X className="h-4 w-4" />
                  Decline
                </Button>
              </ButtonGroup>
            ) : isInsufficientContext && onProvideContext ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsProvidingContext(!isProvidingContext)}
                className="h-8 px-3 border-amber-400 hover:bg-amber-100"
              >
                <Plus className="h-4 w-4" />
                Provide Context
              </Button>
            ) : (
              <ButtonGroup>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onEdit}
                  className="h-8 px-3"
                >
                  Refine
                </Button>
                {onQuickEdit && (
                  <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3"
                        aria-label="Quick Edit"
                      >
                        <Sparkles className="h-4 w-4" />
                        Quick Edit
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="rounded-xl p-0 text-sm w-80">
                      <div className="px-4 py-3 border-b">
                        <div className="text-sm font-semibold">Quick Edit</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Describe how you&apos;d like to improve this field
                        </div>
                      </div>
                      <div className="p-4 space-y-3">
                        <Textarea
                          placeholder="E.g., Make it more concise, add more details..."
                          value={instruction}
                          onChange={(e) => setInstruction(e.target.value)}
                          onKeyDown={handleKeyDown}
                          className="resize-none min-h-24"
                        />
                        <Button
                          size="sm"
                          onClick={handleQuickEdit}
                          disabled={!instruction.trim()}
                          className="w-full"
                        >
                          <Sparkles className="h-4 w-4" />
                          Apply Changes
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </ButtonGroup>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isProcessing ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : isInsufficientContext ? (
          <div className="space-y-4">
            <div className="p-4 border-2 border-dashed border-amber-300 rounded-lg bg-amber-50">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-amber-700 font-medium">
                    Not enough information to generate reliable data
                  </p>

                  {field.requiredInfo && field.requiredInfo.length > 0 && (
                    <div className="mt-3 p-3 bg-amber-100 rounded-md">
                      <p className="text-sm font-medium text-amber-800">
                        Required information:
                      </p>
                      <ul className="text-sm text-amber-700 list-disc list-inside mt-1">
                        {field.requiredInfo.map((info, idx) => (
                          <li key={idx}>{info}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {field.suggestedQuestions && field.suggestedQuestions.length > 0 && (
                    <div className="mt-3 p-3 bg-white border border-amber-200 rounded-md">
                      <p className="text-sm font-medium text-amber-900 mb-2">
                        To improve this field, please answer:
                      </p>
                      <ul className="text-sm text-amber-800 space-y-1">
                        {field.suggestedQuestions.map((question, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-amber-600 font-medium flex-shrink-0">
                              {idx + 1}.
                            </span>
                            <span>{question}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isProvidingContext && (
              <div className="space-y-3 p-4 bg-white border border-amber-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-amber-900">
                    Add context to improve this field:
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsProvidingContext(false)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <Textarea
                  value={contextInput}
                  onChange={(e) => setContextInput(e.target.value)}
                  onKeyDown={handleContextKeyDown}
                  placeholder="Enter specific information (numbers, metrics, dates, etc.)..."
                  className="bg-white resize-none min-h-24"
                />

                <div className="flex gap-2">
                  <Button
                    onClick={handleProvideContext}
                    disabled={!contextInput.trim() || isProcessing}
                    size="sm"
                    className="flex-1"
                  >
                    {isProcessing ? "Regenerating..." : "Regenerate Field"}
                  </Button>
                  <Button
                    onClick={() => setIsProvidingContext(false)}
                    disabled={isProcessing}
                    size="sm"
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className={cn(
              "text-sm leading-relaxed",
              hasPreview && "rounded-lg bg-primary/5 p-4 border border-primary/20"
            )}>
              {hasPreview && previewValue !== null ? renderValue(previewValue) : field.value !== null ? renderValue(field.value) : null}
            </div>

            {field.diagram && (
              <div className="mt-4">
                <MermaidDiagram chart={field.diagram} className="w-full" />
              </div>
            )}
          </>
        )}

        {hasEvidence && (
          <div className="pt-3 border-t">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="group flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform group-hover:text-primary",
                  isExpanded && "rotate-180"
                )}
              />
              <span>View {field.evidence.length} source{field.evidence.length !== 1 && "s"}</span>
            </button>

            {isExpanded && (
              <div className="mt-3 space-y-2">
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
      </CardContent>
    </Card>
  );
}
