"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2,
  FileText,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Users,
  Settings,
  BookOpen,
  Target,
  Shield,
  AlertTriangle,
  Layers,
  ClipboardList,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import type { BusinessCanvas } from "@/lib/validators/canvas-schema";
import type {
  BRDDocument,
  BRDMetadata,
  BRDReviewer,
  BRDApprover,
  GlossaryTerm,
} from "@/lib/validators/brd-schema";
import {
  DEFAULT_APPROVER_ROLES,
  DEFAULT_REVIEWER_ROLES,
  calculateBRDCompleteness,
} from "@/lib/validators/brd-schema";
import { useCanvasStore } from "@/stores/canvas-store";

interface BRDTabProps {
  canvas: BusinessCanvas;
}

type ExtendedCanvas = BusinessCanvas & {
  brd?: BRDDocument;
};

export function BRDTab({ canvas }: BRDTabProps) {
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [brd, setBrd] = React.useState<BRDDocument | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showMetadataPanel, setShowMetadataPanel] = React.useState(false);
  const [canvasesForImport, setCanvasesForImport] = React.useState<Array<{ id: string; title: string }>>([]);
  const setCurrentCanvas = useCanvasStore((state) => state.setCurrentCanvas);
  const currentCanvas = useCanvasStore((state) => state.currentCanvas);

  // Initial form state
  const [initialFormData, setInitialFormData] = React.useState({
    brdOwner: "",
    programName: "",
    portfolioEpic: "",
  });
  const [importFromCanvasId, setImportFromCanvasId] = React.useState<string>("");

  const syncCanvasWithBrd = React.useCallback(
    (brdDoc: BRDDocument | null) => {
      const baseCanvas = (currentCanvas || canvas) as ExtendedCanvas;
      const updatedCanvas: ExtendedCanvas = {
        ...baseCanvas,
        brd: brdDoc || undefined,
        updatedAt: new Date().toISOString(),
      };
      setCurrentCanvas(updatedCanvas);
    },
    [canvas, currentCanvas, setCurrentCanvas]
  );

  // Load existing BRD from canvas on mount
  React.useEffect(() => {
    const extendedCanvas = canvas as ExtendedCanvas;
    if (extendedCanvas.brd) {
      setBrd(extendedCanvas.brd);
    }
  }, [canvas]);

  // Fetch canvases for import dropdown
  React.useEffect(() => {
    const fetchCanvases = async () => {
      try {
        const response = await fetch("/api/canvas/list");
        if (response.ok) {
          const data = await response.json();
          // API returns array directly, not wrapped in { canvases: ... }
          const canvasesList = Array.isArray(data) ? data : (data.canvases || []);
          // Filter out current canvas and only include ones with BRD
          const canvasesWithBrd = canvasesList
            .filter((c: ExtendedCanvas) => c.id !== canvas.id && c.brd)
            .map((c: ExtendedCanvas) => ({
              id: c.id,
              title: c.title?.value || "Untitled Canvas",
            }));
          setCanvasesForImport(canvasesWithBrd);
        }
      } catch (err) {
        console.error("Failed to fetch canvases:", err);
      }
    };
    fetchCanvases();
  }, [canvas.id]);

  // Handle import metadata from another canvas
  const handleImportMetadata = async (canvasId: string) => {
    if (!canvasId) return;

    try {
      const response = await fetch(`/api/canvas/${canvasId}`);
      if (response.ok) {
        const importedCanvas = await response.json() as ExtendedCanvas;
        if (importedCanvas.brd?.metadata) {
          setInitialFormData({
            brdOwner: importedCanvas.brd.metadata.brdOwner || "",
            programName: importedCanvas.brd.metadata.programName || "",
            portfolioEpic: importedCanvas.brd.metadata.portfolioEpic || "",
          });
          toast.success("Metadata imported successfully");
        }
      }
    } catch (err) {
      console.error("Failed to import metadata:", err);
      toast.error("Failed to import metadata");
    }
  };

  const handleGenerateBRD = async () => {
    if (!initialFormData.brdOwner.trim() || !initialFormData.programName.trim()) {
      toast.error("Please fill in required fields", {
        description: "BRD Owner and Program Name are required",
      });
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/canvas/generate-brd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId: canvas.id,
          metadata: {
            brdOwner: initialFormData.brdOwner,
            programName: initialFormData.programName,
            portfolioEpic: initialFormData.portfolioEpic || undefined,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate BRD");
      }

      const result = await response.json();
      setBrd(result.brd);
      syncCanvasWithBrd(result.brd);
      toast.success("BRD generated successfully");
    } catch (err) {
      console.error("BRD generation error:", err);
      setError(err instanceof Error ? err.message : "Failed to generate BRD");
      toast.error("Failed to generate BRD", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateBRD = async () => {
    if (!brd) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/canvas/generate-brd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId: canvas.id,
          metadata: brd.metadata,
          regenerate: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to regenerate BRD");
      }

      const result = await response.json();
      setBrd(result.brd);
      syncCanvasWithBrd(result.brd);
      toast.success("BRD regenerated successfully");
    } catch (err) {
      console.error("BRD regeneration error:", err);
      toast.error("Failed to regenerate BRD");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateMetadata = async (updates: Partial<BRDMetadata>) => {
    if (!brd) return;

    try {
      const response = await fetch("/api/canvas/update-brd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId: canvas.id,
          metadata: { ...brd.metadata, ...updates },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update BRD");
      }

      const result = await response.json();
      setBrd(result.brd);
      syncCanvasWithBrd(result.brd);
      toast.success("BRD updated successfully");
    } catch (err) {
      console.error("BRD update error:", err);
      toast.error("Failed to update BRD");
    }
  };

  const handleExportPDF = async () => {
    if (!brd) return;

    setIsExporting(true);
    try {
      const response = await fetch("/api/canvas/export-brd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId: canvas.id,
          format: "pdf",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to export BRD");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${brd.metadata.programName.replace(/\s+/g, "_")}_BRD.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("BRD exported as PDF");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportWord = async () => {
    if (!brd) return;

    setIsExporting(true);
    try {
      const response = await fetch("/api/canvas/export-brd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId: canvas.id,
          format: "docx",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to export BRD");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${brd.metadata.programName.replace(/\s+/g, "_")}_BRD.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("BRD exported as Word document");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export Word document");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteBRD = async () => {
    try {
      const response = await fetch("/api/canvas/update-brd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId: canvas.id,
          deleteBrd: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete BRD");
      }

      setBrd(null);
      syncCanvasWithBrd(null);
      toast.success("BRD deleted successfully");
    } catch (err) {
      console.error("BRD delete error:", err);
      toast.error("Failed to delete BRD");
    }
  };

  // Empty state - show generation form
  if (!brd) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-center">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold mb-2">Business Requirements Document</h3>
        <p className="text-muted-foreground mb-8 max-w-2xl">
          Generate a comprehensive BRD from your canvas data. The AI will create all sections
          based on your canvas context, including objectives, features, NFRs, and more.
        </p>

        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-lg">Generate BRD</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brdOwner">
                BRD Owner <span className="text-destructive">*</span>
              </Label>
              <Input
                id="brdOwner"
                placeholder="Enter BRD owner name"
                value={initialFormData.brdOwner}
                onChange={(e) =>
                  setInitialFormData({ ...initialFormData, brdOwner: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="programName">
                Program Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="programName"
                placeholder="e.g., Digital Product Creation"
                value={initialFormData.programName}
                onChange={(e) =>
                  setInitialFormData({ ...initialFormData, programName: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="portfolioEpic">Portfolio Epic (Optional)</Label>
              <Input
                id="portfolioEpic"
                placeholder="e.g., ICP-4911"
                value={initialFormData.portfolioEpic}
                onChange={(e) =>
                  setInitialFormData({ ...initialFormData, portfolioEpic: e.target.value })
                }
              />
            </div>

            {canvasesForImport.length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="space-y-2">
                  <Label htmlFor="importFrom" className="flex items-center gap-2">
                    <Copy className="h-4 w-4" />
                    Import metadata from existing BRD
                  </Label>
                  <Select
                    value={importFromCanvasId}
                    onValueChange={(value) => {
                      setImportFromCanvasId(value);
                      handleImportMetadata(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a canvas..." />
                    </SelectTrigger>
                    <SelectContent>
                      {canvasesForImport.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button
              onClick={handleGenerateBRD}
              disabled={isGenerating}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Generating BRD...
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5 mr-2" />
                  Generate BRD
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
          <div className="p-4 border rounded-lg bg-card">
            <div className="flex items-center justify-center mb-2">
              <Target className="h-8 w-8 text-primary" />
            </div>
            <h4 className="font-semibold mb-1">Objectives & Goals</h4>
            <p className="text-sm text-muted-foreground">
              Business goals, success criteria, and key results from your canvas
            </p>
          </div>
          <div className="p-4 border rounded-lg bg-card">
            <div className="flex items-center justify-center mb-2">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h4 className="font-semibold mb-1">Non-Functional Requirements</h4>
            <p className="text-sm text-muted-foreground">
              Performance, security, scalability, and compliance requirements
            </p>
          </div>
          <div className="p-4 border rounded-lg bg-card">
            <div className="flex items-center justify-center mb-2">
              <Layers className="h-8 w-8 text-primary" />
            </div>
            <h4 className="font-semibold mb-1">Features & Scope</h4>
            <p className="text-sm text-muted-foreground">
              Detailed features, use cases, and scope definition
            </p>
          </div>
        </div>
      </div>
    );
  }

  // BRD Document View
  const completeness = calculateBRDCompleteness(brd.metadata);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight">
          {brd.metadata.programName} | BRD
        </h2>
        <p className="text-muted-foreground mt-1">
          Generated {new Date(brd.generatedAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
        <div className="flex items-center gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => setShowMetadataPanel(true)}
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            Metadata
          </Button>
          <Button
            variant="outline"
            onClick={handleRegenerateBRD}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Regenerate
          </Button>
          <Button
            variant="outline"
            onClick={handleExportPDF}
            disabled={isExporting}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
          <Button
            variant="outline"
            onClick={handleExportWord}
            disabled={isExporting}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Word
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="gap-2 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete BRD?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the BRD document for this canvas.
                  You can regenerate it later, but all metadata and customizations will be lost.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteBRD}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete BRD
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-8">

        {/* Completeness Banner */}
        {completeness.percentage < 100 && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <div className="flex-1">
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  BRD is {completeness.percentage}% complete
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-500">
                  Missing: {completeness.missingFields.join(", ")}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMetadataPanel(true)}
              >
                Complete Metadata
              </Button>
            </div>
          </div>
        )}

        {/* Document Info Table */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Program</p>
                <p className="font-medium">{brd.metadata.programName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Portfolio Epic</p>
                <p className="font-medium">{brd.metadata.portfolioEpic || "Not specified"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">BRD Owner</p>
                <p className="font-medium">{brd.metadata.brdOwner}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">BRD Approver</p>
                <p className="font-medium">{brd.metadata.brdApprover || "Not specified"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Approval Date</p>
                <p className="font-medium">{brd.metadata.approvalDate || "Pending"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Version</p>
                <p className="font-medium">{brd.metadata.version || "1.0"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Executive Summary */}
        <BRDSection
          icon={<BookOpen className="h-5 w-5" />}
          title="Executive Summary"
          content={brd.executiveSummary.content}
        />

        {/* Objective */}
        <Card>
          <CardHeader className="bg-muted/30 border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Target className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl">Objective</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div>
              <h4 className="font-semibold text-lg mb-2">Business Goal</h4>
              <p className="text-muted-foreground">{brd.objective.businessGoal}</p>
            </div>
            <Separator />
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold mb-2">What</h4>
                <p className="text-sm text-muted-foreground">{brd.objective.what}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Why</h4>
                <p className="text-sm text-muted-foreground">{brd.objective.why}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Impact</h4>
                <p className="text-sm text-muted-foreground">{brd.objective.impact}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Success Criteria */}
        {brd.successCriteria && brd.successCriteria.length > 0 && (
          <Card>
            <CardHeader className="bg-muted/30 border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <CardTitle className="text-xl">Success Criteria</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">Objective</TableHead>
                    <TableHead>Key Results</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brd.successCriteria.map((criteria) => (
                    <TableRow key={criteria.id}>
                      <TableCell className="font-medium align-top">
                        {criteria.objective}
                      </TableCell>
                      <TableCell>
                        <ul className="list-disc list-inside space-y-1">
                          {criteria.keyResults.map((kr, idx) => (
                            <li key={idx} className="text-muted-foreground">
                              {kr}
                            </li>
                          ))}
                        </ul>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Use Cases */}
        {brd.useCases && brd.useCases.length > 0 && (
          <Card>
            <CardHeader className="bg-muted/30 border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <CardTitle className="text-xl">Use Cases</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Use Case</TableHead>
                    <TableHead className="w-24">Priority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brd.useCases.map((useCase) => (
                    <TableRow key={useCase.id}>
                      <TableCell>{useCase.description}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            useCase.priority === "P1"
                              ? "destructive"
                              : useCase.priority === "P2"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {useCase.priority}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Scope */}
        {brd.scope && brd.scope.length > 0 && (
          <Card>
            <CardHeader className="bg-muted/30 border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Layers className="h-5 w-5" />
                </div>
                <CardTitle className="text-xl">Scope</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>In Scope</TableHead>
                    <TableHead>Out of Scope</TableHead>
                    <TableHead>Undecided</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="align-top">
                      <ul className="list-disc list-inside space-y-1">
                        {brd.scope
                          .filter((s) => s.category === "in_scope")
                          .map((s) => (
                            <li key={s.id} className="text-muted-foreground">
                              {s.description}
                            </li>
                          ))}
                      </ul>
                    </TableCell>
                    <TableCell className="align-top">
                      <ul className="list-disc list-inside space-y-1">
                        {brd.scope
                          .filter((s) => s.category === "out_of_scope")
                          .map((s) => (
                            <li key={s.id} className="text-muted-foreground">
                              {s.description}
                            </li>
                          ))}
                      </ul>
                    </TableCell>
                    <TableCell className="align-top">
                      <ul className="list-disc list-inside space-y-1">
                        {brd.scope
                          .filter((s) => s.category === "undecided")
                          .map((s) => (
                            <li key={s.id} className="text-muted-foreground">
                              {s.description}
                            </li>
                          ))}
                      </ul>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Non-Functional Requirements */}
        {brd.nonFunctionalRequirements && brd.nonFunctionalRequirements.length > 0 && (
          <Card>
            <CardHeader className="bg-muted/30 border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Shield className="h-5 w-5" />
                </div>
                <CardTitle className="text-xl">Non-Functional Requirements</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Category</TableHead>
                    <TableHead>Requirement</TableHead>
                    <TableHead>Acceptance Criteria</TableHead>
                    <TableHead className="w-24">Priority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brd.nonFunctionalRequirements.map((nfr) => (
                    <TableRow key={nfr.id}>
                      <TableCell>
                        <Badge variant="outline">{nfr.category}</Badge>
                      </TableCell>
                      <TableCell>{nfr.requirement}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {nfr.acceptanceCriteria}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            nfr.priority === "P1"
                              ? "destructive"
                              : nfr.priority === "P2"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {nfr.priority}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Assumptions and Constraints */}
        {((brd.assumptions && brd.assumptions.length > 0) || (brd.constraints && brd.constraints.length > 0)) && (
          <div className="grid md:grid-cols-2 gap-6">
            {brd.assumptions && brd.assumptions.length > 0 && (
              <Card>
                <CardHeader className="bg-muted/30 border-b pb-4">
                  <CardTitle className="text-lg">Assumptions</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ul className="list-disc list-inside space-y-2">
                    {brd.assumptions.map((assumption, idx) => (
                      <li key={idx} className="text-muted-foreground">
                        {assumption}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            {brd.constraints && brd.constraints.length > 0 && (
              <Card>
                <CardHeader className="bg-muted/30 border-b pb-4">
                  <CardTitle className="text-lg">Constraints</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ul className="list-disc list-inside space-y-2">
                    {brd.constraints.map((constraint, idx) => (
                      <li key={idx} className="text-muted-foreground">
                        {constraint}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Risks and Mitigations */}
        {brd.risks && brd.risks.length > 0 && (
          <Card>
            <CardHeader className="bg-muted/30 border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <CardTitle className="text-xl">Risks and Mitigations</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Risk</TableHead>
                    <TableHead>Mitigation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brd.risks.map((risk) => (
                    <TableRow key={risk.id}>
                      <TableCell className="font-medium">{risk.risk}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {risk.mitigation}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Features */}
        {brd.features && brd.features.length > 0 && (
          <Card>
            <CardHeader className="bg-muted/30 border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Layers className="h-5 w-5" />
                </div>
                <CardTitle className="text-xl">Features</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feature Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Business Requirements</TableHead>
                      <TableHead>Data Requirements</TableHead>
                      <TableHead>Acceptance Criteria</TableHead>
                      <TableHead className="w-24">Priority</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {brd.features.map((feature) => (
                      <TableRow key={feature.id}>
                        <TableCell className="font-medium">{feature.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {feature.description}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {feature.businessRequirements}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {feature.dataRequirements || "N/A"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {feature.acceptanceCriteria}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              feature.priority === "P1"
                                ? "destructive"
                                : feature.priority === "P2"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {feature.priority}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Governance */}
        {(brd.metadata.signOffApprovers?.length ||
          brd.metadata.reviewers?.length) && (
          <Card>
            <CardHeader className="bg-muted/30 border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <CardTitle className="text-xl">Governance</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {brd.metadata.signOffApprovers &&
                brd.metadata.signOffApprovers.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Sign-off Approvers</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Role</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Function</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {brd.metadata.signOffApprovers.map((approver, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{approver.role}</TableCell>
                            <TableCell>{approver.name || "-"}</TableCell>
                            <TableCell>{approver.function || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

              {brd.metadata.reviewers && brd.metadata.reviewers.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Reviewers</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Role</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Function</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {brd.metadata.reviewers.map((reviewer, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{reviewer.role}</TableCell>
                          <TableCell>{reviewer.name || "-"}</TableCell>
                          <TableCell>{reviewer.function || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Appendix - Glossary */}
        {brd.metadata.glossaryTerms && brd.metadata.glossaryTerms.length > 0 && (
          <Card>
            <CardHeader className="bg-muted/30 border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <BookOpen className="h-5 w-5" />
                </div>
                <CardTitle className="text-xl">Appendix - Glossary</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">Term</TableHead>
                    <TableHead>Definition</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brd.metadata.glossaryTerms.map((term, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{term.term}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {term.definition}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Metadata Panel Sheet */}
      <Sheet open={showMetadataPanel} onOpenChange={setShowMetadataPanel}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto px-6">
          <SheetHeader className="px-0">
            <SheetTitle>BRD Metadata</SheetTitle>
            <SheetDescription>
              Add additional details to complete your BRD
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6 px-0">
            <MetadataPanel
              metadata={brd.metadata}
              onUpdate={handleUpdateMetadata}
              completeness={completeness}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// BRD Section Component
function BRDSection({
  icon,
  title,
  content,
}: {
  icon: React.ReactNode;
  title: string;
  content: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/30 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">{icon}</div>
          <CardTitle className="text-xl">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => (
                <p className="mb-4 leading-relaxed text-muted-foreground">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="list-disc pl-6 mb-4 space-y-2 text-muted-foreground">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal pl-6 mb-4 space-y-2 text-muted-foreground">
                  {children}
                </ol>
              ),
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              strong: ({ children }) => (
                <strong className="font-semibold text-foreground">{children}</strong>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  );
}

// Metadata Panel Component
function MetadataPanel({
  metadata,
  onUpdate,
  completeness,
}: {
  metadata: BRDMetadata;
  onUpdate: (updates: Partial<BRDMetadata>) => void;
  completeness: { percentage: number; missingFields: string[] };
}) {
  const [localMetadata, setLocalMetadata] = React.useState(metadata);
  const [expandedSections, setExpandedSections] = React.useState<string[]>([
    "governance",
  ]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  const handleSave = () => {
    onUpdate(localMetadata);
  };

  const addApprover = () => {
    const newApprover: BRDApprover = { role: "", name: "", function: "" };
    setLocalMetadata({
      ...localMetadata,
      signOffApprovers: [...(localMetadata.signOffApprovers || []), newApprover],
    });
  };

  const removeApprover = (index: number) => {
    setLocalMetadata({
      ...localMetadata,
      signOffApprovers: localMetadata.signOffApprovers?.filter((_, i) => i !== index),
    });
  };

  const updateApprover = (index: number, field: keyof BRDApprover, value: string) => {
    const updated = [...(localMetadata.signOffApprovers || [])];
    updated[index] = { ...updated[index], [field]: value };
    setLocalMetadata({ ...localMetadata, signOffApprovers: updated });
  };

  const addReviewer = () => {
    const newReviewer: BRDReviewer = { role: "", name: "", function: "" };
    setLocalMetadata({
      ...localMetadata,
      reviewers: [...(localMetadata.reviewers || []), newReviewer],
    });
  };

  const removeReviewer = (index: number) => {
    setLocalMetadata({
      ...localMetadata,
      reviewers: localMetadata.reviewers?.filter((_, i) => i !== index),
    });
  };

  const updateReviewer = (index: number, field: keyof BRDReviewer, value: string) => {
    const updated = [...(localMetadata.reviewers || [])];
    updated[index] = { ...updated[index], [field]: value };
    setLocalMetadata({ ...localMetadata, reviewers: updated });
  };

  const addGlossaryTerm = () => {
    const newTerm: GlossaryTerm = { term: "", definition: "" };
    setLocalMetadata({
      ...localMetadata,
      glossaryTerms: [...(localMetadata.glossaryTerms || []), newTerm],
    });
  };

  const removeGlossaryTerm = (index: number) => {
    setLocalMetadata({
      ...localMetadata,
      glossaryTerms: localMetadata.glossaryTerms?.filter((_, i) => i !== index),
    });
  };

  const updateGlossaryTerm = (index: number, field: keyof GlossaryTerm, value: string) => {
    const updated = [...(localMetadata.glossaryTerms || [])];
    updated[index] = { ...updated[index], [field]: value };
    setLocalMetadata({ ...localMetadata, glossaryTerms: updated });
  };

  return (
    <div className="space-y-6">
      {/* Completeness */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Completeness</span>
          <span className="text-sm text-muted-foreground">
            {completeness.percentage}%
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${completeness.percentage}%` }}
          />
        </div>
        {completeness.missingFields.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Missing: {completeness.missingFields.join(", ")}
          </p>
        )}
      </div>

      {/* Basic Info */}
      <div className="space-y-4">
        <h4 className="font-semibold">Document Info</h4>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="brdApprover">BRD Approver</Label>
            <Input
              id="brdApprover"
              value={localMetadata.brdApprover || ""}
              onChange={(e) =>
                setLocalMetadata({ ...localMetadata, brdApprover: e.target.value })
              }
              placeholder="Enter approver name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="approvalDate">Approval Date</Label>
            <Input
              id="approvalDate"
              type="date"
              value={localMetadata.approvalDate || ""}
              onChange={(e) =>
                setLocalMetadata({ ...localMetadata, approvalDate: e.target.value })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="version">Version</Label>
            <Input
              id="version"
              value={localMetadata.version || ""}
              onChange={(e) =>
                setLocalMetadata({ ...localMetadata, version: e.target.value })
              }
              placeholder="e.g., 1.0"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Sign-off Approvers */}
      <Collapsible
        open={expandedSections.includes("approvers")}
        onOpenChange={() => toggleSection("approvers")}
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full">
          <h4 className="font-semibold">Sign-off Approvers</h4>
          {expandedSections.includes("approvers") ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-3">
          {(localMetadata.signOffApprovers || []).map((approver, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <div className="flex-1 space-y-2">
                <Select
                  value={approver.role}
                  onValueChange={(value) => updateApprover(idx, "role", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_APPROVER_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Name"
                  value={approver.name || ""}
                  onChange={(e) => updateApprover(idx, "name", e.target.value)}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeApprover(idx)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addApprover}>
            <Plus className="h-4 w-4 mr-2" />
            Add Approver
          </Button>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Reviewers */}
      <Collapsible
        open={expandedSections.includes("reviewers")}
        onOpenChange={() => toggleSection("reviewers")}
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full">
          <h4 className="font-semibold">Reviewers</h4>
          {expandedSections.includes("reviewers") ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-3">
          {(localMetadata.reviewers || []).map((reviewer, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <div className="flex-1 space-y-2">
                <Select
                  value={reviewer.role}
                  onValueChange={(value) => updateReviewer(idx, "role", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_REVIEWER_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Name"
                  value={reviewer.name || ""}
                  onChange={(e) => updateReviewer(idx, "name", e.target.value)}
                />
                <Input
                  placeholder="Function"
                  value={reviewer.function || ""}
                  onChange={(e) => updateReviewer(idx, "function", e.target.value)}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeReviewer(idx)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addReviewer}>
            <Plus className="h-4 w-4 mr-2" />
            Add Reviewer
          </Button>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Glossary */}
      <Collapsible
        open={expandedSections.includes("glossary")}
        onOpenChange={() => toggleSection("glossary")}
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full">
          <h4 className="font-semibold">Glossary Terms</h4>
          {expandedSections.includes("glossary") ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-3">
          {(localMetadata.glossaryTerms || []).map((term, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="Term"
                  value={term.term}
                  onChange={(e) => updateGlossaryTerm(idx, "term", e.target.value)}
                />
                <Textarea
                  placeholder="Definition"
                  value={term.definition}
                  onChange={(e) =>
                    updateGlossaryTerm(idx, "definition", e.target.value)
                  }
                  className="min-h-16"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeGlossaryTerm(idx)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addGlossaryTerm}>
            <Plus className="h-4 w-4 mr-2" />
            Add Term
          </Button>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Save Button */}
      <Button onClick={handleSave} className="w-full">
        Save Metadata
      </Button>
    </div>
  );
}
