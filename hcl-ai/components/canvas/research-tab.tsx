"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Building2, TrendingUp, Users, Server, DollarSign, Sparkles, RefreshCw, ExternalLink, Pencil, Save, X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type { BusinessCanvas, ResearchReport } from "@/lib/validators/canvas-schema";
import { ResearchImpactDialog } from "./research-impact-dialog";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useCanvasStore } from "@/stores/canvas-store";

interface ResearchTabProps {
  canvas: BusinessCanvas;
}

interface ResearchSection {
  title: string;
  content: string;
  sources?: Array<{ title: string; url: string }>;
}

export function ResearchTab({ canvas }: ResearchTabProps) {
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [research, setResearch] = React.useState<ResearchReport | null>(null);
  const [draftResearch, setDraftResearch] = React.useState<ResearchReport | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showImpactDialog, setShowImpactDialog] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isRefining, setIsRefining] = React.useState(false);
  const [refineInstruction, setRefineInstruction] = React.useState("");

  const setCurrentCanvas = useCanvasStore((state) => state.setCurrentCanvas);
  const addAuditLogEntry = useCanvasStore((state) => state.addAuditLogEntry);
  const currentCanvas = useCanvasStore((state) => state.currentCanvas);

  // Load saved research on mount
  React.useEffect(() => {
    if (canvas.research) {
      setResearch(canvas.research);
      setDraftResearch(canvas.research);
    }
  }, [canvas]);

  const normalizeResearch = (input: ResearchReport): ResearchReport => ({
    ...input,
    competitorAnalysis: {
      ...input.competitorAnalysis,
      sources: input.competitorAnalysis.sources || [],
    },
    internalApplications: {
      ...input.internalApplications,
      sources: input.internalApplications.sources || [],
    },
    industryBenchmarks: {
      ...input.industryBenchmarks,
      sources: input.industryBenchmarks.sources || [],
    },
    estimatedImpact: {
      ...input.estimatedImpact,
      sources: input.estimatedImpact.sources || [],
    },
    recommendations: {
      ...input.recommendations,
      sources: input.recommendations.sources || [],
    },
    strategicImplications: input.strategicImplications
      ? { ...input.strategicImplications, sources: input.strategicImplications.sources || [] }
      : undefined,
  });

  const handleGenerateResearch = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/canvas/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId: canvas.id,
          problemStatement: canvas.problemStatement?.value || "",
          industry: canvas.industry,
          objectives: Array.isArray(canvas.objectives?.value)
            ? canvas.objectives.value.join(", ")
            : canvas.objectives?.value || "",
          targetMarket: "",
          uploadedFiles: canvas.uploadedFiles || [],
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate research");
      }

      const result = await response.json();
      const normalized = normalizeResearch(result.research);
      setResearch(normalized);
      setDraftResearch(normalized);

      // Push to shared canvas so collaborators see the update immediately
      const baseCanvas = currentCanvas || canvas;
      const updatedCanvas: BusinessCanvas = {
        ...baseCanvas,
        research: normalized,
        updatedAt: new Date().toISOString(),
      };
      setCurrentCanvas(updatedCanvas);
    } catch (err) {
      console.error("Research generation error:", err);
      setError(err instanceof Error ? err.message : "Failed to generate research");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyResearch = async (changes: Record<string, string>) => {
    try {
      const response = await fetch("/api/canvas/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId: canvas.id,
          updates: changes,
        }),
      });

      if (!response.ok) throw new Error("Failed to apply changes");

      const updatedCanvas: BusinessCanvas = await response.json();
      const normalizedResearch = updatedCanvas.research
        ? normalizeResearch(updatedCanvas.research)
        : research || draftResearch;

      setCurrentCanvas(
        normalizedResearch
          ? { ...updatedCanvas, research: normalizedResearch }
          : updatedCanvas
      );

      if (normalizedResearch) {
        setResearch(normalizedResearch);
        setDraftResearch(normalizedResearch);
      }

      toast.success("Canvas updated successfully", {
        description: `Applied ${Object.keys(changes).length} research-based update${Object.keys(changes).length > 1 ? 's' : ''} to your canvas.`,
      });
    } catch (err) {
      console.error("Error applying research changes:", err);
      toast.error("Failed to update canvas", {
        description: err instanceof Error ? err.message : "An unexpected error occurred. Please try again.",
      });
    }
  };

  const handleSaveResearch = async () => {
    if (!draftResearch) return;
    setIsSaving(true);
    const normalized = normalizeResearch(draftResearch);
    try {
      const response = await fetch("/api/canvas/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId: canvas.id,
          updates: { research: normalized },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save research");
      }

      setResearch(normalized);
      setDraftResearch(normalized);
      setIsEditing(false);

      const baseCanvas = currentCanvas || canvas;
      const updatedCanvas = {
        ...baseCanvas,
        research: normalized,
        updatedAt: new Date().toISOString(),
      };
      setCurrentCanvas(updatedCanvas);
      await addAuditLogEntry({
        canvasId: canvas.id,
        action: "edit_field",
        description: "Edited research report",
        metadata: { fieldKey: "research" },
      });

      toast.success("Research saved");
    } catch (err) {
      console.error("Failed to save research:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save research");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefineResearch = async () => {
    if (!draftResearch && !research) return;
    if (!refineInstruction.trim()) {
      toast.error("Add a quick instruction for the AI first.");
      return;
    }

    setIsRefining(true);
    try {
      const response = await fetch("/api/canvas/refine-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId: canvas.id,
          fieldKey: "research",
          instruction: refineInstruction,
          currentValue: draftResearch || research,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to refine research");
      }

      const data = await response.json();
      const refined = normalizeResearch(data.value || data);
      setDraftResearch(refined);
      setResearch(refined);
      setIsEditing(true);
      toast.success("AI refined the research. Review and save.");
      await addAuditLogEntry({
        canvasId: canvas.id,
        action: "refine_field",
        description: "AI refined research report",
        metadata: { fieldKey: "research", instruction: refineInstruction },
      });
    } catch (err) {
      console.error("Failed to refine research:", err);
      toast.error(err instanceof Error ? err.message : "Failed to refine research");
    } finally {
      setIsRefining(false);
    }
  };

  const handleStartEdit = () => {
    if (!research) return;
    setDraftResearch(research);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setDraftResearch(research);
    setIsEditing(false);
  };

  const updateSection = (key: keyof ResearchReport, updates: Partial<ResearchSection>) => {
    setDraftResearch((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [key]: {
          ...(prev[key] as ResearchSection),
          ...updates,
        },
      };
    });
  };

  const updateSource = (sectionKey: keyof ResearchReport, index: number, field: "title" | "url", value: string) => {
    setDraftResearch((prev) => {
      if (!prev) return prev;
      const section = prev[sectionKey] as ResearchSection;
      const sources = [...(section.sources || [])];
      sources[index] = { ...sources[index], [field]: value };
      return {
        ...prev,
        [sectionKey]: {
          ...section,
          sources,
        },
      };
    });
  };

  const addSource = (sectionKey: keyof ResearchReport) => {
    setDraftResearch((prev) => {
      if (!prev) return prev;
      const section = prev[sectionKey] as ResearchSection;
      const sources = [...(section.sources || []), { title: "", url: "" }];
      return {
        ...prev,
        [sectionKey]: {
          ...section,
          sources,
        },
      };
    });
  };

  const removeSource = (sectionKey: keyof ResearchReport, index: number) => {
    setDraftResearch((prev) => {
      if (!prev) return prev;
      const section = prev[sectionKey] as ResearchSection;
      const sources = [...(section.sources || [])];
      sources.splice(index, 1);
      return {
        ...prev,
        [sectionKey]: {
          ...section,
          sources,
        },
      };
    });
  };

  if (!research) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-center">
        <Search className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold mb-2">Competitive Intelligence & Research</h3>
        <p className="text-muted-foreground mb-6 max-w-2xl">
          Generate comprehensive research on how competitors solved similar challenges, industry trends,
          benchmarks, and actionable recommendations based on your canvas.
        </p>
        <Button onClick={handleGenerateResearch} disabled={isGenerating} size="lg">
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Researching...
            </>
          ) : (
            <>
              <Search className="h-5 w-5 mr-2" />
              Generate Research Report
            </>
          )}
        </Button>
        {error && (
          <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg max-w-md">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
          <div className="p-4 border rounded-lg bg-card">
            <div className="flex items-center justify-center mb-2">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <h4 className="font-semibold mb-1">Competitor Strategies</h4>
            <p className="text-sm text-muted-foreground">
              How leading companies approached similar challenges and their results
            </p>
          </div>
          <div className="p-4 border rounded-lg bg-card">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            <h4 className="font-semibold mb-1">Industry Trends</h4>
            <p className="text-sm text-muted-foreground">
              Emerging practices, benchmarks, and performance metrics
            </p>
          </div>
          <div className="p-4 border rounded-lg bg-card">
            <div className="flex items-center justify-center mb-2">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h4 className="font-semibold mb-1">Recommendations</h4>
            <p className="text-sm text-muted-foreground">
              Actionable insights based on research and best practices
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Research Report</h2>
          <p className="text-muted-foreground mt-1">
            Competitive intelligence and industry insights based on your canvas
          </p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Cancel edit
              </Button>
              <Button
                onClick={handleSaveResearch}
                disabled={isSaving}
                className="gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save report
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              onClick={handleStartEdit}
              className="gap-2"
            >
              <Pencil className="h-4 w-4" />
              Edit report
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowImpactDialog(true)}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Apply Findings to Canvas
          </Button>
          <Button
            variant="outline"
            onClick={handleGenerateResearch}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Regenerating...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Regenerate Report
              </>
            )}
          </Button>
        </div>
      </div>

      <Card className="border-dashed bg-muted/30">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Freeform edits or AI polish</p>
              <p className="text-xs text-muted-foreground">
                Update the report directly and optionally ask the AI to refine it before saving.
              </p>
            </div>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={handleStartEdit} className="gap-2">
                <Pencil className="h-4 w-4" />
                Edit manually
              </Button>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-[2fr,1fr]">
            <Textarea
              value={refineInstruction}
              onChange={(e) => setRefineInstruction(e.target.value)}
              placeholder="e.g., Make the competitor analysis punchier and add a short ROI summary."
              rows={3}
            />
            <div className="flex items-end justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRefineInstruction("");
                }}
                size="sm"
              >
                Clear
              </Button>
              <Button
                onClick={handleRefineResearch}
                disabled={isRefining || !refineInstruction.trim()}
                size="sm"
                className="gap-2"
              >
                {isRefining ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Refining...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Ask AI to refine
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-8">
        {/* Competitor Analysis */}
        <EditableResearchSection
          icon={<Building2 className="h-5 w-5" />}
          title={isEditing ? draftResearch?.competitorAnalysis.title || "" : research.competitorAnalysis.title}
          content={isEditing ? draftResearch?.competitorAnalysis.content || "" : research.competitorAnalysis.content}
          sources={isEditing ? draftResearch?.competitorAnalysis.sources || [] : research.competitorAnalysis.sources}
          isEditing={isEditing}
          onChangeContent={(value) => updateSection("competitorAnalysis", { content: value })}
          onChangeTitle={(value) => updateSection("competitorAnalysis", { title: value })}
          onChangeSource={(index, field, value) => updateSource("competitorAnalysis", index, field, value)}
          onAddSource={() => addSource("competitorAnalysis")}
          onRemoveSource={(index) => removeSource("competitorAnalysis", index)}
        />

        {/* Internal Applications */}
        <EditableResearchSection
          icon={<Server className="h-5 w-5" />}
          title={isEditing ? draftResearch?.internalApplications.title || "" : research.internalApplications.title}
          content={isEditing ? draftResearch?.internalApplications.content || "" : research.internalApplications.content}
          sources={isEditing ? draftResearch?.internalApplications.sources || [] : research.internalApplications.sources}
          isEditing={isEditing}
          onChangeContent={(value) => updateSection("internalApplications", { content: value })}
          onChangeTitle={(value) => updateSection("internalApplications", { title: value })}
          onChangeSource={(index, field, value) => updateSource("internalApplications", index, field, value)}
          onAddSource={() => addSource("internalApplications")}
          onRemoveSource={(index) => removeSource("internalApplications", index)}
        />

        {/* Industry Benchmarks */}
        <EditableResearchSection
          icon={<TrendingUp className="h-5 w-5" />}
          title={isEditing ? draftResearch?.industryBenchmarks.title || "" : research.industryBenchmarks.title}
          content={isEditing ? draftResearch?.industryBenchmarks.content || "" : research.industryBenchmarks.content}
          sources={isEditing ? draftResearch?.industryBenchmarks.sources || [] : research.industryBenchmarks.sources}
          isEditing={isEditing}
          onChangeContent={(value) => updateSection("industryBenchmarks", { content: value })}
          onChangeTitle={(value) => updateSection("industryBenchmarks", { title: value })}
          onChangeSource={(index, field, value) => updateSource("industryBenchmarks", index, field, value)}
          onAddSource={() => addSource("industryBenchmarks")}
          onRemoveSource={(index) => removeSource("industryBenchmarks", index)}
        />

        {/* Estimated Impact */}
        <EditableResearchSection
          icon={<DollarSign className="h-5 w-5" />}
          title={isEditing ? draftResearch?.estimatedImpact.title || "" : research.estimatedImpact.title}
          content={isEditing ? draftResearch?.estimatedImpact.content || "" : research.estimatedImpact.content}
          sources={isEditing ? draftResearch?.estimatedImpact.sources || [] : research.estimatedImpact.sources}
          isEditing={isEditing}
          onChangeContent={(value) => updateSection("estimatedImpact", { content: value })}
          onChangeTitle={(value) => updateSection("estimatedImpact", { title: value })}
          onChangeSource={(index, field, value) => updateSource("estimatedImpact", index, field, value)}
          onAddSource={() => addSource("estimatedImpact")}
          onRemoveSource={(index) => removeSource("estimatedImpact", index)}
        />

        {/* Strategic Implications (New Section) */}
        {research.strategicImplications && (
          <EditableResearchSection
            icon={<Sparkles className="h-5 w-5" />}
            title={isEditing ? draftResearch?.strategicImplications?.title || "" : research.strategicImplications.title}
            content={isEditing ? draftResearch?.strategicImplications?.content || "" : research.strategicImplications.content}
            sources={isEditing ? draftResearch?.strategicImplications?.sources || [] : research.strategicImplications.sources}
            isEditing={isEditing}
            onChangeContent={(value) => updateSection("strategicImplications", { content: value })}
            onChangeTitle={(value) => updateSection("strategicImplications", { title: value })}
            onChangeSource={(index, field, value) => updateSource("strategicImplications", index, field, value)}
            onAddSource={() => addSource("strategicImplications")}
            onRemoveSource={(index) => removeSource("strategicImplications", index)}
          />
        )}

        {/* Recommendations */}
        <EditableResearchSection
          icon={<Sparkles className="h-5 w-5" />}
          title={isEditing ? draftResearch?.recommendations.title || "" : research.recommendations.title}
          content={isEditing ? draftResearch?.recommendations.content || "" : research.recommendations.content}
          sources={isEditing ? draftResearch?.recommendations.sources || [] : research.recommendations.sources}
          isEditing={isEditing}
          onChangeContent={(value) => updateSection("recommendations", { content: value })}
          onChangeTitle={(value) => updateSection("recommendations", { title: value })}
          onChangeSource={(index, field, value) => updateSource("recommendations", index, field, value)}
          onAddSource={() => addSource("recommendations")}
          onRemoveSource={(index) => removeSource("recommendations", index)}
        />
      </div>

      <ResearchImpactDialog
        open={showImpactDialog}
        onOpenChange={setShowImpactDialog}
        canvasId={canvas.id}
        research={research}
        onApply={handleApplyResearch}
      />
    </div>
  );
}

interface ResearchSectionProps {
  icon: React.ReactNode;
  title: string;
  content: string;
  sources?: Array<{ title: string; url: string }>;
}

/**
 * SECURITY: Validates that a URL uses a safe protocol (http or https)
 * Prevents javascript:, data:, vbscript: and other dangerous protocols
 */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function ResearchSection({ icon, title, content, sources }: ResearchSectionProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/30 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            {icon}
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-4">{children}</h1>,
              h2: ({ children }) => <h2 className="text-xl font-bold mt-8 mb-4 pb-2 border-b">{children}</h2>,
              h3: ({ children }) => <h3 className="text-lg font-semibold mt-6 mb-3">{children}</h3>,
              p: ({ children }) => <p className="mb-4 leading-relaxed text-muted-foreground">{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-2 text-muted-foreground">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-2 text-muted-foreground">{children}</ol>,
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-primary/30 pl-4 italic my-4 text-muted-foreground">
                  {children}
                </blockquote>
              ),
              table: ({ children }) => (
                <div className="rounded-lg border my-6 overflow-hidden bg-card">
                  <Table>{children}</Table>
                </div>
              ),
              thead: ({ children }) => <TableHeader className="bg-muted/50">{children}</TableHeader>,
              tbody: ({ children }) => <TableBody>{children}</TableBody>,
              tr: ({ children }) => <TableRow className="hover:bg-muted/50">{children}</TableRow>,
              th: ({ children }) => (
                <TableHead className="font-semibold text-foreground h-12">
                  {children}
                </TableHead>
              ),
              td: ({ children }) => (
                <TableCell className="py-3">
                  {children}
                </TableCell>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
        {sources && sources.length > 0 && (
          <div className="mt-8 pt-4 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Sources</p>
            <div className="flex flex-wrap gap-2">
              {sources.map((source, idx) => {
                // SECURITY: Only render links with safe protocols (http/https)
                if (!isSafeUrl(source.url)) {
                  return null;
                }
                return (
                  <a
                    key={idx}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group"
                  >
                    <Badge
                      variant="secondary"
                      className="hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer px-3 py-1"
                    >
                      <ExternalLink className="h-3 w-3 mr-2 group-hover:text-primary-foreground" />
                      <span className="max-w-[250px] truncate">{source.title}</span>
                    </Badge>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface EditableResearchSectionProps extends ResearchSectionProps {
  isEditing: boolean;
  onChangeContent: (value: string) => void;
  onChangeTitle: (value: string) => void;
  onChangeSource: (index: number, field: "title" | "url", value: string) => void;
  onAddSource: () => void;
  onRemoveSource: (index: number) => void;
}

function EditableResearchSection({
  icon,
  title,
  content,
  sources = [],
  isEditing,
  onChangeContent,
  onChangeTitle,
  onChangeSource,
  onAddSource,
  onRemoveSource,
}: EditableResearchSectionProps) {
  if (!isEditing) {
    return (
      <ResearchSection
        icon={icon}
        title={title}
        content={content}
        sources={sources}
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/30 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            {icon}
          </div>
          <div className="flex-1 space-y-1">
            <Input
              value={title}
              onChange={(e) => onChangeTitle(e.target.value)}
              placeholder="Section title"
            />
            <p className="text-xs text-muted-foreground">Edit the title and content freely. Sources are optional.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <Textarea
          value={content}
          onChange={(e) => onChangeContent(e.target.value)}
          rows={6}
          placeholder="Write or paste your research summary..."
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Sources</p>
            <Button variant="outline" size="sm" onClick={onAddSource} className="gap-1">
              <Plus className="h-4 w-4" />
              Add source
            </Button>
          </div>
          {sources.length === 0 && (
            <p className="text-xs text-muted-foreground">No sources added. You can keep this empty if not applicable.</p>
          )}
          <div className="space-y-3">
            {sources.map((source, idx) => (
              <div key={`${source.title}-${idx}`} className="grid gap-2 md:grid-cols-[1fr,1fr,auto] items-center">
                <Input
                  value={source.title}
                  onChange={(e) => onChangeSource(idx, "title", e.target.value)}
                  placeholder="Title"
                />
                <Input
                  value={source.url}
                  onChange={(e) => onChangeSource(idx, "url", e.target.value)}
                  placeholder="URL"
                />
                <Button variant="ghost" size="sm" onClick={() => onRemoveSource(idx)} className="text-destructive">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <Separator />
        <p className="text-xs text-muted-foreground">
          Save the report at the top once you finish editing. AI refinements appear in these fields, so you can review before saving.
        </p>
      </CardContent>
    </Card>
  );
}
