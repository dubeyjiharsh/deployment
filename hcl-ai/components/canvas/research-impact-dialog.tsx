"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Check, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

interface Change {
  fieldKey: string;
  fieldName: string;
  currentValue: unknown;
  proposedValue: unknown;
  reasoning: string;
}

interface ResearchImpactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canvasId: string;
  research: unknown;
  onApply: (changes: Record<string, string>) => Promise<void>;
}

const formatValueForDisplay = (val: unknown): string => {
  if (Array.isArray(val)) {
    // Format arrays as bullet points
    return val.map(item => {
      if (typeof item === 'string') {
        return `• ${item}`;
      }
      return `• ${JSON.stringify(item)}`;
    }).join('\n');
  }
  if (typeof val === 'object' && val !== null) {
    return JSON.stringify(val, null, 2);
  }
  return String(val || "");
};

const parseDisplayValue = (displayValue: string, originalValue: unknown): string => {
  // If original was an array and display value has bullet points, convert back to JSON array
  if (Array.isArray(originalValue) && displayValue.includes('•')) {
    const items = displayValue
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Remove bullet point and trim
        const cleaned = line.replace(/^[•\-\*]\s*/, '').trim();
        return cleaned;
      })
      .filter(item => item.length > 0);
    return JSON.stringify(items, null, 2);
  }
  return displayValue;
};

export function ResearchImpactDialog({
  open,
  onOpenChange,
  canvasId,
  research,
  onApply,
}: ResearchImpactDialogProps) {
  const [analyzing, setAnalyzing] = React.useState(false);
  const [analysis, setAnalysis] = React.useState<{
    changes: Change[];
    downstreamImpact: { stories: boolean; execution: boolean; explanation: string };
  } | null>(null);
  const [displayValues, setDisplayValues] = React.useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = React.useState<string>("");

  React.useEffect(() => {
    // Reset stale analysis when dialog is closed so the next open re-runs with fresh data
    if (!open) {
      setAnalysis(null);
      setDisplayValues({});
      setActiveTab("");
    }
  }, [open]);

  React.useEffect(() => {
    // Re-run analysis when research or canvas context changes
    setAnalysis(null);
    setDisplayValues({});
    setActiveTab("");
  }, [research, canvasId]);

  const analyzeImpact = React.useCallback(async () => {
    setAnalyzing(true);
    try {
      const response = await fetch("/api/canvas/apply-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasId, research }),
      });
      
      if (!response.ok) throw new Error("Analysis failed");
      
      const data = await response.json();
      setAnalysis(data);

      // Initialize display values (formatted for user-friendly display)
      const initialDisplay: Record<string, string> = {};
      data.changes.forEach((c: Change) => {
        initialDisplay[c.fieldKey] = formatValueForDisplay(c.proposedValue);
      });
      setDisplayValues(initialDisplay);

      if (data.changes.length > 0) {
        setActiveTab(data.changes[0].fieldKey);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  }, [canvasId, research]);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open && !analysis && !analyzing) {
      analyzeImpact();
    }
  }, [open, analysis, analyzing, analyzeImpact]);

  const handleApply = async () => {
    // Convert display values back to proper format before saving
    const finalValues: Record<string, string> = {};
    if (analysis) {
      analysis.changes.forEach((change) => {
        const displayValue = displayValues[change.fieldKey];
        finalValues[change.fieldKey] = parseDisplayValue(displayValue, change.proposedValue);
      });
    }
    await onApply(finalValues);
    onOpenChange(false);
  };

  if (analyzing) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Analyzing Research Impact</DialogTitle>
            <DialogDescription>
              Comparing research findings with your current canvas...
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Identifying necessary updates...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Review Suggested Changes</DialogTitle>
          <DialogDescription>
            The following updates are recommended based on the research findings.
            Review and refine each change before applying.
          </DialogDescription>
        </DialogHeader>

        {analysis?.downstreamImpact?.explanation && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="mb-2">Warning: Downstream Impact</AlertTitle>
            <AlertDescription>
              {(analysis.downstreamImpact.stories || analysis.downstreamImpact.execution) && (
                <div className="flex gap-2 mb-3">
                  {analysis.downstreamImpact.stories && (
                    <Badge variant="outline" className="bg-destructive/10 border-destructive/20 text-destructive">
                      Stories Tab
                    </Badge>
                  )}
                  {analysis.downstreamImpact.execution && (
                    <Badge variant="outline" className="bg-destructive/10 border-destructive/20 text-destructive">
                      Execution Plan Tab
                    </Badge>
                  )}
                </div>
              )}
              <p className="text-sm opacity-90 leading-relaxed">
                {analysis.downstreamImpact.explanation}
              </p>
              {(analysis.downstreamImpact.stories || analysis.downstreamImpact.execution) && (
                <p className="mt-2 font-medium text-xs uppercase tracking-wide opacity-80">
                  Note: Updating the canvas may require regenerating these artifacts.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {analysis?.changes && analysis.changes.length > 0 ? (
          <div className="flex-1 flex gap-6 overflow-hidden">
            {/* Sidebar: List of Fields */}
            <div className="w-1/4 border-r pr-4 overflow-y-auto">
              <h4 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wider">Affected Fields</h4>
              <div className="space-y-2">
                {analysis.changes.map((change) => (
                  <button
                    key={change.fieldKey}
                    onClick={() => setActiveTab(change.fieldKey)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      activeTab === change.fieldKey
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    {change.fieldName || change.fieldKey}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content: Diff View */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {analysis.changes.map((change) => (
                change.fieldKey === activeTab && (
                  <div key={change.fieldKey} className="flex flex-col h-full space-y-4">
                    <div className="bg-muted/30 p-3 rounded-lg border">
                      <span className="text-xs font-semibold text-primary uppercase">Reasoning</span>
                      <p className="text-sm mt-1 text-muted-foreground">{change.reasoning}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden min-h-0">
                      <div className="flex flex-col min-h-0">
                        <h5 className="text-sm font-medium mb-2 text-muted-foreground">Current Value</h5>
                        <ScrollArea className="flex-1 border rounded-md bg-muted/10 min-h-0">
                          <div className="text-sm whitespace-pre-wrap opacity-70 p-3">
                            {formatValueForDisplay(change.currentValue) || "(Empty)"}
                          </div>
                        </ScrollArea>
                      </div>

                      <div className="flex flex-col min-h-0">
                         <div className="flex items-center justify-between mb-2">
                           <h5 className="text-sm font-medium text-primary">Proposed New Value</h5>
                           <Badge variant="outline" className="text-xs">Editable</Badge>
                         </div>
                        <Textarea
                          className="flex-1 resize-none text-sm bg-background min-h-0"
                          value={displayValues[change.fieldKey]}
                          onChange={(e) => setDisplayValues(prev => ({ ...prev, [change.fieldKey]: e.target.value }))}
                          placeholder="Enter values, one per line with • bullet points for arrays"
                        />
                      </div>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <Check className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold">No Changes Needed</h3>
            <p className="text-muted-foreground text-center max-w-md mt-2">
              Your canvas is already well-aligned with the research findings.
            </p>
          </div>
        )}

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {analysis?.changes && analysis.changes.length > 0 && (
            <Button onClick={handleApply}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Apply {analysis.changes.length} Updates
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
