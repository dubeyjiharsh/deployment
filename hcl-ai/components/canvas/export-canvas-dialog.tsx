"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, FileSpreadsheet, Loader2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Story, ExecutionPlan } from "@/stores/canvas-store";
import type { Benchmark } from "@/lib/validators/canvas-schema";

interface ExportCanvasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canvasId: string;
  canvasTitle: string;
  hasResearch?: boolean;
  hasStories?: boolean;
  hasBenchmarks?: boolean;
  hasExecutionPlan?: boolean;
  // Pass the actual data from the store
  stories?: Story[];
  benchmarks?: Benchmark[];
  executionPlan?: ExecutionPlan | null;
}

export function ExportCanvasDialog({
  open,
  onOpenChange,
  canvasId,
  canvasTitle,
  hasResearch = false,
  hasStories = false,
  hasBenchmarks = false,
  hasExecutionPlan = false,
  stories = [],
  benchmarks = [],
  executionPlan = null,
}: ExportCanvasDialogProps) {
  const [format, setFormat] = useState<"pdf" | "docx">("docx");
  const [isExporting, setIsExporting] = useState(false);
  const [sections, setSections] = useState({
    canvas: true,
    research: hasResearch,
    epics: hasStories,
    benchmarks: hasBenchmarks,
    executionPlan: hasExecutionPlan,
  });

  // Update sections when availability changes
  useEffect(() => {
    setSections(prev => ({
      ...prev,
      research: hasResearch ? prev.research : false,
      epics: hasStories ? prev.epics : false,
      benchmarks: hasBenchmarks ? prev.benchmarks : false,
      executionPlan: hasExecutionPlan ? prev.executionPlan : false,
    }));
  }, [hasResearch, hasStories, hasBenchmarks, hasExecutionPlan]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/canvas/export-full", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          canvasId,
          format,
          includeSections: sections,
          // Pass the store data to the API
          stories: sections.epics ? stories : [],
          benchmarks: sections.benchmarks ? benchmarks : [],
          executionPlan: sections.executionPlan ? executionPlan : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to export canvas");
      }

      // Get the blob and download it
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${canvasTitle.replace(/\s+/g, "_")}_Canvas.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      onOpenChange(false);
    } catch (error) {
      console.error("Export error:", error);
      alert(error instanceof Error ? error.message : "Failed to export canvas");
    } finally {
      setIsExporting(false);
    }
  };

  const toggleSection = (key: keyof typeof sections) => {
    // Don't allow unchecking canvas - it's required
    if (key === "canvas") return;
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Canvas
          </DialogTitle>
          <DialogDescription>
            Download your canvas as a Word document or PDF file. Select the sections you want to include.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Format</Label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormat("docx")}
                className={cn(
                  "flex flex-col items-center justify-between rounded-md border-2 bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors",
                  format === "docx" ? "border-primary" : "border-muted"
                )}
              >
                <FileText className="mb-3 h-6 w-6" />
                <span className="text-sm font-medium">Word Document</span>
                <span className="text-xs text-muted-foreground">.docx</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat("pdf")}
                className={cn(
                  "flex flex-col items-center justify-between rounded-md border-2 bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors",
                  format === "pdf" ? "border-primary" : "border-muted"
                )}
              >
                <FileSpreadsheet className="mb-3 h-6 w-6" />
                <span className="text-sm font-medium">PDF Document</span>
                <span className="text-xs text-muted-foreground">.pdf</span>
              </button>
            </div>
          </div>

          {/* Section Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Include Sections</Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="canvas"
                  checked={sections.canvas}
                  disabled
                />
                <Label
                  htmlFor="canvas"
                  className="text-sm font-normal cursor-pointer"
                >
                  Canvas Fields (Problem, Objectives, KPIs, Risks, etc.)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="research"
                  checked={sections.research}
                  onCheckedChange={() => toggleSection("research")}
                  disabled={!hasResearch}
                />
                <Label
                  htmlFor="research"
                  className={`text-sm font-normal cursor-pointer ${!hasResearch ? "text-muted-foreground" : ""}`}
                >
                  Research Report
                  {!hasResearch && (
                    <span className="ml-2 text-xs text-muted-foreground">(Not generated)</span>
                  )}
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="epics"
                  checked={sections.epics}
                  onCheckedChange={() => toggleSection("epics")}
                  disabled={!hasStories}
                />
                <Label
                  htmlFor="epics"
                  className={`text-sm font-normal cursor-pointer ${!hasStories ? "text-muted-foreground" : ""}`}
                >
                  Epics & User Stories
                  {!hasStories && (
                    <span className="ml-2 text-xs text-muted-foreground">(Not generated)</span>
                  )}
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="benchmarks"
                  checked={sections.benchmarks}
                  onCheckedChange={() => toggleSection("benchmarks")}
                  disabled={!hasBenchmarks}
                />
                <Label
                  htmlFor="benchmarks"
                  className={`text-sm font-normal cursor-pointer ${!hasBenchmarks ? "text-muted-foreground" : ""}`}
                >
                  Industry Benchmarks
                  {!hasBenchmarks && (
                    <span className="ml-2 text-xs text-muted-foreground">(Not generated)</span>
                  )}
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="executionPlan"
                  checked={sections.executionPlan}
                  onCheckedChange={() => toggleSection("executionPlan")}
                  disabled={!hasExecutionPlan}
                />
                <Label
                  htmlFor="executionPlan"
                  className={`text-sm font-normal cursor-pointer ${!hasExecutionPlan ? "text-muted-foreground" : ""}`}
                >
                  Execution Plan (Sprints & Resources)
                  {!hasExecutionPlan && (
                    <span className="ml-2 text-xs text-muted-foreground">(Not generated)</span>
                  )}
                </Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export {format.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
