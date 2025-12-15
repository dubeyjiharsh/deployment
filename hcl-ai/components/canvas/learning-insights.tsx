"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface LearningInsightsProps {
  fieldKey: string;
  onSuggestionClick: (instruction: string) => void;
}

interface Insight {
  commonInstructions: Array<{ instruction: string; count: number }>;
  fieldPatterns: Array<{
    instruction: string;
    beforeValue: string;
    afterValue: string;
  }>;
  stats: {
    totalRefinements: number;
    uniqueCanvases: number;
    mostRefinedField: { fieldKey: string; fieldLabel: string; count: number } | null;
    recentRefinements: number;
  };
}

/**
 * Display AI learning insights from past refinements
 */
export function LearningInsights({ fieldKey, onSuggestionClick }: LearningInsightsProps): React.ReactElement {
  const [insights, setInsights] = React.useState<Insight | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isExpanded, setIsExpanded] = React.useState(false);

  React.useEffect(() => {
    const fetchInsights = async () => {
      try {
        const response = await fetch(`/api/canvas/refinement-history?insights=true&fieldKey=${fieldKey}`);
        if (response.ok) {
          const data = await response.json();
          setInsights(data);
        }
      } catch (error) {
        console.error("Failed to fetch learning insights:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInsights();
  }, [fieldKey]);

  if (isLoading || !insights) {
    return <div />;
  }

  const commonInstructions = insights.commonInstructions || [];
  const fieldPatterns = insights.fieldPatterns || [];
  const stats = insights.stats || {
    totalRefinements: 0,
    uniqueCanvases: 0,
    mostRefinedField: null,
    recentRefinements: 0,
  };

  const hasInsights =
    commonInstructions.length > 0 ||
    fieldPatterns.length > 0 ||
    stats.totalRefinements > 0;

  if (!hasInsights) {
    return <div />;
  }

  return (
    <div className="mb-4 rounded-lg border bg-muted/30 p-4">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">AI Learning Insights</h4>
          {stats.totalRefinements > 0 && (
            <Badge variant="secondary" className="text-xs">
              {stats.totalRefinements} refinements tracked
            </Badge>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {stats.totalRefinements > 0 && (
            <div className="text-xs text-muted-foreground">
              <p>
                Based on <strong>{stats.uniqueCanvases}</strong> canvases and{" "}
                <strong>{stats.recentRefinements}</strong> recent refinements
              </p>
              {stats.mostRefinedField && (
                <p className="mt-1">
                  Most refined: <strong>{stats.mostRefinedField.fieldLabel}</strong> (
                  {stats.mostRefinedField.count} times)
                </p>
              )}
            </div>
          )}

          {commonInstructions.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Common refinement patterns:</p>
              <div className="space-y-2">
                {commonInstructions.slice(0, 3).map((item, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => onSuggestionClick(item.instruction)}
                    className="w-full justify-start text-left h-auto py-2 px-3"
                  >
                    <Sparkles className="h-3 w-3 mr-2 flex-shrink-0 text-primary" />
                    <span className="flex-1 text-xs">{item.instruction}</span>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {item.count}×
                    </Badge>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {fieldPatterns.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Recent refinements for this field:
              </p>
              <div className="space-y-2">
                {fieldPatterns.slice(0, 2).map((pattern, index) => {
                  let beforeText = "";
                  let afterText = "";
                  try {
                    const parsedBefore = JSON.parse(pattern.beforeValue);
                    beforeText = (typeof parsedBefore === "string" ? parsedBefore : JSON.stringify(parsedBefore)).substring(0, 50);
                  } catch {
                    beforeText = pattern.beforeValue?.toString()?.substring(0, 50) ?? "";
                  }
                  try {
                    const parsedAfter = JSON.parse(pattern.afterValue);
                    afterText = (typeof parsedAfter === "string" ? parsedAfter : JSON.stringify(parsedAfter)).substring(0, 50);
                  } catch {
                    afterText = pattern.afterValue?.toString()?.substring(0, 50) ?? "";
                  }
                  return (
                  <div key={index} className="rounded-md bg-background p-2 text-xs">
                    <p className="font-medium text-muted-foreground mb-1">&quot;{pattern.instruction}&quot;</p>
                    <div className="space-y-1 text-muted-foreground/80">
                      <p className="line-clamp-1">
                        <span className="font-medium">Before:</span>{" "}
                        {beforeText}...
                      </p>
                      <p className="line-clamp-1">
                        <span className="font-medium">After:</span>{" "}
                        {afterText}...
                      </p>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
