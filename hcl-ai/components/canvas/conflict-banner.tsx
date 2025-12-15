"use client";

import * as React from "react";
import { Conflict, ConflictResolution } from "@/stores/canvas-store";
import { AlertTriangle, CheckCircle2, Info, X, Sparkles, Loader2, ChevronDown, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getFieldLabel } from "@/lib/utils/canvas-helpers";

interface ConflictBannerProps {
  conflicts: Conflict[];
  canvasId: string;
  onResolve?: (conflictId: string) => void;
  onApplyFix?: (conflictId: string, resolution: ConflictResolution) => Promise<void>;
  onDismiss?: () => void;
}

export function ConflictBanner({
  conflicts,
  canvasId,
  onResolve,
  onApplyFix,
  onDismiss,
}: ConflictBannerProps): React.ReactElement | null {
  const [loadingResolutions, setLoadingResolutions] = React.useState<Set<string>>(new Set());
  const [applyingFixes, setApplyingFixes] = React.useState<Set<string>>(new Set());
  const [expandedConflicts, setExpandedConflicts] = React.useState<Set<string>>(new Set());

  const unresolvedConflicts = conflicts.filter((c) => !c.resolved);

  if (unresolvedConflicts.length === 0) {
    return null;
  }

  const highConflicts = unresolvedConflicts.filter((c) => c.severity === "high");
  const mediumConflicts = unresolvedConflicts.filter((c) => c.severity === "medium");
  const lowConflicts = unresolvedConflicts.filter((c) => c.severity === "low");

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "border-destructive/50 bg-destructive/10";
      case "medium":
        return "border-warning/50 bg-warning/10";
      case "low":
        return "border-blue-500/50 bg-blue-500/10";
      default:
        return "border-border bg-muted/50";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "high":
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case "medium":
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      case "low":
        return <Info className="h-5 w-5 text-blue-500" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  const handleGetSuggestion = async (conflict: Conflict) => {
    setLoadingResolutions(prev => new Set(prev).add(conflict.id));

    try {
      const response = await fetch("/api/canvas/resolve-conflict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId,
          conflictId: conflict.id,
          conflict,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get suggestion");
      }

      const { resolution } = await response.json();

      // Update the conflict with the resolution
      const event = new CustomEvent("updateConflictResolution", {
        detail: { conflictId: conflict.id, resolution },
      });
      window.dispatchEvent(event);

      // Expand to show the resolution
      setExpandedConflicts(prev => new Set(prev).add(conflict.id));
    } catch (error) {
      console.error("Failed to get suggestion:", error);
      alert("Failed to get AI suggestion. Please try again.");
    } finally {
      setLoadingResolutions(prev => {
        const newSet = new Set(prev);
        newSet.delete(conflict.id);
        return newSet;
      });
    }
  };

  const handleApplyFix = async (conflict: Conflict) => {
    if (!conflict.resolution || !onApplyFix) return;

    setApplyingFixes(prev => new Set(prev).add(conflict.id));

    try {
      await onApplyFix(conflict.id, conflict.resolution);

      // Mark as resolved
      if (onResolve) {
        onResolve(conflict.id);
      }
    } catch (error) {
      console.error("Failed to apply fix:", error);
      alert("Failed to apply fix. Please try again.");
    } finally {
      setApplyingFixes(prev => {
        const newSet = new Set(prev);
        newSet.delete(conflict.id);
        return newSet;
      });
    }
  };

  const toggleExpanded = (conflictId: string) => {
    setExpandedConflicts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(conflictId)) {
        newSet.delete(conflictId);
      } else {
        newSet.add(conflictId);
      }
      return newSet;
    });
  };

  const renderValue = (value: unknown): string => {
    if (value === null || value === undefined) return "Not specified";
    if (Array.isArray(value)) return `${value.length} items`;
    if (typeof value === "object") return JSON.stringify(value).substring(0, 100) + "...";
    return String(value).substring(0, 100);
  };

  return (
    <div className="space-y-3 mb-6">
      {/* Summary Banner */}
      <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/50 bg-destructive/10">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">
              {unresolvedConflicts.length} conflict{unresolvedConflicts.length !== 1 && "s"} detected
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {highConflicts.length > 0 && `${highConflicts.length} high`}
              {mediumConflicts.length > 0 && (highConflicts.length > 0 ? `, ${mediumConflicts.length} medium` : `${mediumConflicts.length} medium`)}
              {lowConflicts.length > 0 && ((highConflicts.length > 0 || mediumConflicts.length > 0) ? `, ${lowConflicts.length} low` : `${lowConflicts.length} low`)}
            </p>
          </div>
        </div>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-8 w-8 p-0"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Detailed Conflicts */}
      <div className="space-y-2">
        {unresolvedConflicts.map((conflict) => {
          const isExpanded = expandedConflicts.has(conflict.id);
          const isLoading = loadingResolutions.has(conflict.id);
          const isApplying = applyingFixes.has(conflict.id);
          const hasResolution = !!conflict.resolution;

          return (
            <div
              key={conflict.id}
              className={cn(
                "rounded-lg border transition-all",
                getSeverityColor(conflict.severity)
              )}
            >
              <div className="flex items-start gap-3 p-4">
                {getSeverityIcon(conflict.severity)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge
                      variant={
                        conflict.severity === "high"
                          ? "destructive"
                          : conflict.severity === "medium"
                          ? "default"
                          : "secondary"
                      }
                      className="text-xs uppercase"
                    >
                      {conflict.severity}
                    </Badge>
                    <Badge variant="outline" className="text-xs capitalize">
                      {conflict.conflictType}
                    </Badge>
                  </div>
                  <p className="text-sm leading-relaxed mb-3">{conflict.description}</p>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-muted-foreground">
                      Fields: {conflict.fieldKeys.map(key => getFieldLabel(key)).join(", ")}
                    </span>
                  </div>

                  {/* Resolution Section */}
                  {hasResolution && isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                      <div className="flex items-start gap-2">
                        <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium mb-1">AI Suggestion</p>
                          <p className="text-sm text-muted-foreground mb-3">
                            {conflict.resolution?.explanation}
                          </p>
                        </div>
                      </div>

                      {/* Suggested Changes */}
                      <div className="space-y-2">
                        {conflict.resolution && Object.entries(conflict.resolution.suggestedChanges).map(([fieldKey, change]) => (
                          <div key={fieldKey} className="rounded-lg bg-background/50 border p-3 space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="text-sm font-medium">{getFieldLabel(fieldKey)}</p>
                              <Badge variant="outline" className="text-xs">Change</Badge>
                            </div>

                            <div className="space-y-2 text-xs">
                              <div className="p-2 rounded bg-muted/50">
                                <p className="text-muted-foreground mb-1">Current:</p>
                                <p className="text-foreground">{renderValue(change.currentValue)}</p>
                              </div>

                              <div className="flex justify-center">
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              </div>

                              <div className="p-2 rounded bg-primary/10 border border-primary/20">
                                <p className="text-muted-foreground mb-1">Suggested:</p>
                                <p className="text-foreground font-medium">{renderValue(change.suggestedValue)}</p>
                              </div>
                            </div>

                            <p className="text-xs text-muted-foreground italic mt-2">
                              {change.reason}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  {!hasResolution ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGetSuggestion(conflict)}
                      disabled={isLoading}
                      className="h-8"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          <span className="text-xs">Getting AI Fix...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                          <span className="text-xs">Get AI Fix</span>
                        </>
                      )}
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(conflict.id)}
                        className="h-8"
                      >
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 transition-transform",
                            isExpanded && "rotate-180"
                          )}
                        />
                        <span className="text-xs ml-1.5">
                          {isExpanded ? "Hide" : "View"} Fix
                        </span>
                      </Button>
                      {isExpanded && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleApplyFix(conflict)}
                          disabled={isApplying}
                          className="h-8"
                        >
                          {isApplying ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                              <span className="text-xs">Applying...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                              <span className="text-xs">Apply Fix</span>
                            </>
                          )}
                        </Button>
                      )}
                    </>
                  )}
                  {onResolve && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onResolve(conflict.id)}
                      className="h-8"
                    >
                      <X className="h-3.5 w-3.5 mr-1.5" />
                      <span className="text-xs">Dismiss</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
