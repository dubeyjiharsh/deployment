"use client";

import { useCanvasStore } from "@/stores/canvas-store";
import { getFieldLabel } from "@/lib/utils/canvas-helpers";
import type { BusinessCanvas, CanvasField } from "@/lib/validators/canvas-schema";

interface UseCanvasHandlersProps {
  canvas: BusinessCanvas;
}

interface UseCanvasHandlersReturn {
  // Field editing
  handleEditField: (fieldName: string) => void;
  handleQuickEdit: (fieldKey: keyof BusinessCanvas, instruction: string) => Promise<unknown>;
  handleAcceptEdit: (fieldKey: keyof BusinessCanvas, value: unknown) => Promise<void>;
  handleProvideContext: (fieldKey: keyof BusinessCanvas, context: string) => Promise<unknown>;

  // Story generation (Yale workflow)
  handleGenerateEpics: () => Promise<void>;
  handleGenerateFeatures: () => Promise<void>;
  handleGenerateUserStories: () => Promise<void>;
  handleClearStories: () => void;
  handleExportToJira: () => Promise<void>;

  // Execution plan
  handleGenerateExecution: () => Promise<void>;

  // Benchmarks
  handleGenerateBenchmarks: (industry: string) => Promise<void>;
}

/**
 * Custom hook that provides all canvas-related handlers
 * Reduces code duplication and keeps canvas-grid.tsx cleaner
 */
export function useCanvasHandlers({ canvas }: UseCanvasHandlersProps): UseCanvasHandlersReturn {
  const setActiveField = useCanvasStore((state) => state.setActiveField);
  const setCurrentCanvas = useCanvasStore((state) => state.setCurrentCanvas);
  const stories = useCanvasStore((state) => state.stories);
  const setStories = useCanvasStore((state) => state.setStories);
  const setGeneratingStories = useCanvasStore((state) => state.setGeneratingStories);
  const setExecutionPlan = useCanvasStore((state) => state.setExecutionPlan);
  const setGeneratingExecution = useCanvasStore((state) => state.setGeneratingExecution);
  const setBenchmarks = useCanvasStore((state) => state.setBenchmarks);
  const setGeneratingBenchmarks = useCanvasStore((state) => state.setGeneratingBenchmarks);
  const setGeneratingEpics = useCanvasStore((state) => state.setGeneratingEpics);
  const setGeneratingFeatures = useCanvasStore((state) => state.setGeneratingFeatures);
  const addStories = useCanvasStore((state) => state.addStories);
  const addAuditLogEntry = useCanvasStore((state) => state.addAuditLogEntry);
  const currentCanvas = useCanvasStore((state) => state.currentCanvas);

  const handleEditField = (fieldName: string): void => {
    setActiveField(fieldName);
  };

  const handleQuickEdit = async (fieldKey: keyof BusinessCanvas, instruction: string): Promise<unknown> => {
    try {
      const response = await fetch("/api/canvas/refine-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId: canvas.id,
          fieldKey,
          instruction,
          currentValue: canvas[fieldKey],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to refine field" }));
        throw new Error(errorData.error || "Failed to refine field");
      }

      const { value } = await response.json();
      return value;
    } catch (error) {
      console.error("Quick edit failed:", error);
      throw error;
    }
  };

  const handleAcceptEdit = async (fieldKey: keyof BusinessCanvas, value: unknown): Promise<void> => {
    try {
      const beforeValue = (canvas[fieldKey] as CanvasField<unknown>)?.value;

      const updatedCanvas = {
        ...canvas,
        [fieldKey]: {
          ...(canvas[fieldKey] as CanvasField<unknown>),
          value,
        },
        updatedAt: new Date().toISOString(),
      };

      const response = await fetch(`/api/canvas/${canvas.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCanvas),
      });

      if (!response.ok) {
        throw new Error("Failed to save canvas");
      }

      setCurrentCanvas(updatedCanvas);

      await addAuditLogEntry({
        canvasId: canvas.id,
        action: "edit_field",
        description: `Edited field: ${getFieldLabel(String(fieldKey))}`,
        metadata: {
          fieldKey: String(fieldKey),
          fieldLabel: getFieldLabel(String(fieldKey)),
          beforeValue: typeof beforeValue === 'object' ? JSON.stringify(beforeValue) : String(beforeValue || ''),
          afterValue: typeof value === 'object' ? JSON.stringify(value) : String(value || ''),
        }
      });
    } catch (error) {
      console.error("Failed to save changes:", error);
      throw error;
    }
  };

  const handleProvideContext = async (fieldKey: keyof BusinessCanvas, context: string): Promise<unknown> => {
    try {
      const response = await fetch("/api/canvas/provide-field-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId: canvas.id,
          fieldKey,
          context,
          currentField: canvas[fieldKey],
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to regenerate field with context");
      }

      const { value } = await response.json();
      return value;
    } catch (error) {
      console.error("Provide context failed:", error);
      throw error;
    }
  };

  const handleGenerateEpics = async (): Promise<void> => {
    try {
      setGeneratingEpics(true);
      const currentSelectedOKRs = useCanvasStore.getState().selectedOKRs;

      const response = await fetch("/api/canvas/generate-epics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId: canvas.id,
          selectedOKRIds: currentSelectedOKRs
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to generate epics");
      }

      const { epics: generatedEpics } = await response.json();
      addStories(generatedEpics);

      addAuditLogEntry({
        canvasId: canvas.id,
        action: "generate_epics",
        description: `Generated ${generatedEpics.length} epics from ${currentSelectedOKRs.length} selected OKRs`,
        metadata: {
          selectedOKRIds: currentSelectedOKRs,
          epicCount: generatedEpics.length
        }
      });
    } catch (error) {
      console.error("Failed to generate epics:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate epics";
      alert(`Failed to generate epics: ${errorMessage}`);
    } finally {
      setGeneratingEpics(false);
    }
  };

  const handleGenerateFeatures = async (): Promise<void> => {
    try {
      setGeneratingFeatures(true);
      const epics = stories.filter(s => s.type === "epic");
      const currentSelectedEpics = useCanvasStore.getState().selectedEpics;

      const response = await fetch("/api/canvas/generate-features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId: canvas.id,
          epics,
          selectedEpicIds: currentSelectedEpics
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to generate features");
      }

      const { features: generatedFeatures } = await response.json();
      addStories(generatedFeatures);

      addAuditLogEntry({
        canvasId: canvas.id,
        action: "generate_features",
        description: `Generated ${generatedFeatures.length} features from ${currentSelectedEpics.length} selected epics`,
        metadata: {
          selectedEpicIds: currentSelectedEpics,
          featureCount: generatedFeatures.length
        }
      });
    } catch (error) {
      console.error("Failed to generate features:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate features";
      alert(`Failed to generate features: ${errorMessage}`);
    } finally {
      setGeneratingFeatures(false);
    }
  };

  const handleGenerateUserStories = async (): Promise<void> => {
    try {
      setGeneratingStories(true);
      const features = stories.filter(s => s.type === "feature");
      const currentSelectedFeatures = useCanvasStore.getState().selectedFeatures;

      const response = await fetch("/api/canvas/generate-user-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId: canvas.id,
          features,
          selectedFeatureIds: currentSelectedFeatures
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to generate user stories");
      }

      const { stories: generatedStories } = await response.json();
      addStories(generatedStories);

      addAuditLogEntry({
        canvasId: canvas.id,
        action: "generate_stories",
        description: `Generated ${generatedStories.length} stories from ${currentSelectedFeatures.length} selected features`,
        metadata: {
          selectedFeatureIds: currentSelectedFeatures,
          storyCount: generatedStories.length
        }
      });
    } catch (error) {
      console.error("Failed to generate user stories:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate user stories";
      alert(`Failed to generate user stories: ${errorMessage}`);
    } finally {
      setGeneratingStories(false);
    }
  };

  const handleClearStories = (): void => {
    if (confirm("Are you sure you want to clear all stories? This will also clear the execution plan. This action cannot be undone.")) {
      setStories([]);
      setExecutionPlan(null);
    }
  };

  const handleExportToJira = async (): Promise<void> => {
    const epics = stories.filter(s => s.type === "epic");
    const features = stories.filter(s => s.type === "feature");
    const userStories = stories.filter(s => s.type === "user-story");
    const devStories = stories.filter(s => s.type === "dev-story");
    const totalCount = epics.length + features.length + userStories.length + devStories.length;

    const exportSummary = `
JIRA Export Summary:

This would export ${totalCount} items with full lineage tracking:
- ${epics.length} Epics
- ${features.length} Features (mapped to parent Epics)
- ${userStories.length} User Stories (mapped to parent Features)
- ${devStories.length} Dev Stories (mapped to parent Features)

Each item includes:
✓ Complete lineage (parentOKR, epic, feature)
✓ Priority and story points
✓ Acceptance criteria
✓ Origin requirement for audit traceability

To implement JIRA export:
1. Configure JIRA MCP server in settings
2. Select target JIRA project
3. API endpoint will map story types to JIRA issue types
4. Create issues with proper hierarchy and links

Would you like to proceed? (Feature coming soon)
    `.trim();

    alert(exportSummary);

    addAuditLogEntry({
      canvasId: canvas.id,
      action: "export_to_jira",
      description: `Attempted JIRA export of ${totalCount} items (${epics.length} epics, ${features.length} features, ${userStories.length} user stories, ${devStories.length} dev stories)`,
      metadata: {
        epicCount: epics.length,
        featureCount: features.length,
        userStoryCount: userStories.length,
        devStoryCount: devStories.length,
        totalCount,
        status: "pending_implementation"
      }
    });
  };

  const handleGenerateExecution = async (): Promise<void> => {
    try {
      setGeneratingExecution(true);

      const response = await fetch("/api/canvas/generate-execution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasId: canvas.id, stories }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to generate execution plan");
      }

      const { executionPlan: generatedPlan } = await response.json();

      // Validate that we got a proper execution plan
      if (!generatedPlan || (!generatedPlan.sprints?.length && !generatedPlan.resources?.length)) {
        console.warn("⚠️ Received empty or invalid execution plan, retrying may help");
      }

      setExecutionPlan(generatedPlan);

      if (currentCanvas) {
        const updatedCanvas = {
          ...currentCanvas,
          executionPlan: generatedPlan,
          updatedAt: new Date().toISOString(),
        };
        setCurrentCanvas(updatedCanvas);

        try {
          await fetch(`/api/canvas/${canvas.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedCanvas),
          });
        } catch (saveError) {
          console.error("Failed to auto-save execution plan:", saveError);
        }
      }
    } catch (error) {
      console.error("Failed to generate execution plan:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate execution plan";
      alert(`Failed to generate execution plan: ${errorMessage}`);
    } finally {
      setGeneratingExecution(false);
    }
  };

  const handleGenerateBenchmarks = async (industry: string): Promise<void> => {
    try {
      setGeneratingBenchmarks(true);

      const response = await fetch("/api/canvas/generate-benchmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasId: canvas.id, industry }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate benchmarks");
      }

      const { benchmarks: generatedBenchmarks } = await response.json();
      setBenchmarks(generatedBenchmarks);

      if (currentCanvas) {
        const updatedCanvas = {
          ...currentCanvas,
          benchmarks: generatedBenchmarks,
          updatedAt: new Date().toISOString(),
        };
        setCurrentCanvas(updatedCanvas);

        try {
          await fetch(`/api/canvas/${canvas.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedCanvas),
          });
        } catch (saveError) {
          console.error("Failed to auto-save benchmarks:", saveError);
        }
      }
    } catch (error) {
      console.error("Failed to generate benchmarks:", error);
      alert("Failed to generate benchmarks");
    } finally {
      setGeneratingBenchmarks(false);
    }
  };

  return {
    handleEditField,
    handleQuickEdit,
    handleAcceptEdit,
    handleProvideContext,
    handleGenerateEpics,
    handleGenerateFeatures,
    handleGenerateUserStories,
    handleClearStories,
    handleExportToJira,
    handleGenerateExecution,
    handleGenerateBenchmarks,
  };
}
