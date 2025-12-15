import { create } from "zustand";
import type { BusinessCanvas, CanvasField, ChatMessage, Benchmark } from "@/lib/validators/canvas-schema";
import { createEmptyCanvas } from "@/lib/utils/canvas-helpers";
import { nanoid } from "nanoid";

export interface Story {
  id: string;
  type: "epic" | "feature" | "user-story" | "dev-story";
  title: string;
  description: string;
  acceptanceCriteria?: string[];
  priority?: "high" | "medium" | "low";
  storyPoints?: number;
  epic?: string; // For features, user stories and dev stories, references the epic
  feature?: string; // For user stories and dev stories, references the feature
  // Lineage tracking for Yale requirements
  parentOKR?: string; // For epics, references the OKR objective ID
  originRequirement?: string; // Original requirement text from problem statement
}

export interface Sprint {
  id: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  stories: string[]; // Story IDs
  capacity: number;
  velocity?: number;
}

export interface OKR {
  id: string;
  type: "objective" | "key-result";
  title: string;
  description: string;
  targetValue?: string;
  currentValue?: string;
  parentId?: string; // For key results, references the objective
  dueDate?: string;
  owner?: string;
}

export interface Resource {
  id: string;
  type: "people" | "budget" | "tools" | "infrastructure";
  name: string;
  description: string;
  allocation: string;
  cost?: string;
  timeline?: string;
}

export interface ExecutionPlan {
  sprints: Sprint[];
  resources: Resource[];
}

export interface ConflictResolution {
  explanation: string;
  suggestedChanges: Record<string, {
    currentValue: unknown;
    suggestedValue: unknown;
    reason: string;
  }>;
  priority: "high" | "medium" | "low";
}

export interface Conflict {
  id: string;
  canvasId: string;
  conflictType: "budget" | "timeline" | "scope" | "resource" | "risk" | "other";
  fieldKeys: string[]; // Canvas field keys involved
  description: string;
  severity: "high" | "medium" | "low";
  resolved: boolean;
  detectedAt: string;
  resolution?: ConflictResolution;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  canvasId: string;
  action: "generate_okrs" | "edit_okr" | "select_okr" | "generate_epics" | "edit_epic" | "select_epic" | "generate_features" | "edit_feature" | "select_feature" | "generate_stories" | "edit_story" | "edit_field" | "refine_field" | "export_to_jira" | "other";
  description: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface BusinessRequirement {
  id: string;
  title: string;
  description: string;
  category: string;
}

export interface EpicSuggestion {
  id: string;
  title: string;
  description: string;
  priority?: "high" | "medium" | "low";
  sourceId: string; // The requirement or OKR ID this was generated from
  addedToCanvas?: boolean; // Track if this suggestion has been added
  canvasItemId?: string; // The ID of the canvas item created from this suggestion
}

export interface FeatureSuggestion {
  id: string;
  title: string;
  description: string;
  priority?: "high" | "medium" | "low";
  storyPoints?: number;
  epicId: string; // The epic this was generated for
  addedToCanvas?: boolean; // Track if this suggestion has been added
  canvasItemId?: string; // The ID of the canvas item created from this suggestion
}

export interface StorySuggestion {
  id: string;
  type: "user-story" | "dev-story";
  title: string;
  description: string;
  priority?: "high" | "medium" | "low";
  storyPoints?: number;
  acceptanceCriteria?: string[];
  featureId: string; // The feature this was generated for
  addedToCanvas?: boolean; // Track if this suggestion has been added
  canvasItemId?: string; // The ID of the canvas item created from this suggestion
}

interface CanvasState {
  // Current canvas
  currentCanvas: BusinessCanvas | null;

  // Canvas list
  canvases: BusinessCanvas[];

  // Active field being edited
  activeField: string | null;

  // Chat messages for current canvas
  messages: ChatMessage[];

  // Stories for current canvas (Epics, Features, User Stories, Dev Stories)
  stories: Story[];

  // Execution plan for current canvas
  executionPlan: ExecutionPlan | null;

  // Conflicts for current canvas
  conflicts: Conflict[];

  // Benchmarks for current canvas
  benchmarks: Benchmark[];

  // Yale workflow: Selected items for step-by-step generation
  selectedOKRs: string[]; // OKR IDs selected for Epic generation
  selectedEpics: string[]; // Epic IDs selected for Feature generation
  selectedFeatures: string[]; // Feature IDs selected for Story generation

  // JIRA integration
  jiraProjectId: string | null;
  availableJiraProjects: Array<{ id: string; key: string; name: string }>;

  // Audit log (immutable)
  auditLog: AuditLogEntry[];

  // Business requirements and suggestions (persisted)
  businessRequirements: BusinessRequirement[];
  epicSuggestions: EpicSuggestion[];
  featureSuggestions: FeatureSuggestion[];
  storySuggestions: StorySuggestion[];

  // Loading states
  isGenerating: boolean;
  isRefining: boolean;
  isSaving: boolean;
  isGeneratingEpics: boolean;
  isGeneratingFeatures: boolean;
  isGeneratingStories: boolean;
  isGeneratingExecution: boolean;
  isDetectingConflicts: boolean;
  isGeneratingBenchmarks: boolean;
  isExportingToJira: boolean;

  // Actions
  setCurrentCanvas: (canvas: BusinessCanvas) => void;
  updateField: <T>(fieldName: keyof BusinessCanvas, field: CanvasField<T>) => void;
  setActiveField: (fieldName: string | null) => void;
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  setGenerating: (isGenerating: boolean) => void;
  setRefining: (isRefining: boolean) => void;
  setSaving: (isSaving: boolean) => void;
  createNewCanvas: () => void;
  loadCanvases: (canvases: BusinessCanvas[]) => void;
  updateCanvasStatus: (status: BusinessCanvas["status"]) => void;

  // Story management
  setStories: (stories: Story[]) => void;
  addStories: (stories: Story[]) => void; // Add new stories without replacing
  updateStory: (storyId: string, updates: Partial<Story>) => void;

  // Yale workflow: Selection management
  setSelectedOKRs: (okrIds: string[]) => void;
  toggleOKRSelection: (okrId: string) => void;
  setSelectedEpics: (epicIds: string[]) => void;
  toggleEpicSelection: (epicId: string) => void;
  setSelectedFeatures: (featureIds: string[]) => void;
  toggleFeatureSelection: (featureId: string) => void;

  // Loading states
  setGeneratingEpics: (isGenerating: boolean) => void;
  setGeneratingFeatures: (isGenerating: boolean) => void;
  setGeneratingStories: (isGeneratingStories: boolean) => void;
  setExecutionPlan: (plan: ExecutionPlan | null) => void;
  setGeneratingExecution: (isGenerating: boolean) => void;
  setConflicts: (conflicts: Conflict[]) => void;
  setDetectingConflicts: (isDetecting: boolean) => void;
  resolveConflict: (conflictId: string) => void;
  updateConflictResolution: (conflictId: string, resolution: ConflictResolution) => void;
  setBenchmarks: (benchmarks: Benchmark[]) => void;
  setGeneratingBenchmarks: (isGenerating: boolean) => void;

  // JIRA integration
  setJiraProjectId: (projectId: string | null) => void;
  setAvailableJiraProjects: (projects: Array<{ id: string; key: string; name: string }>) => void;
  setExportingToJira: (isExporting: boolean) => void;

  // Audit log
  addAuditLogEntry: (entry: Omit<AuditLogEntry, "id" | "timestamp">) => Promise<void>;

  // Business requirements and suggestions
  setBusinessRequirements: (requirements: BusinessRequirement[]) => void;
  setEpicSuggestions: (suggestions: EpicSuggestion[]) => void;
  addEpicSuggestions: (suggestions: EpicSuggestion[]) => void;
  removeEpicSuggestion: (suggestionId: string) => void;
  markEpicSuggestionAdded: (suggestionId: string, canvasItemId: string) => void;
  restoreEpicSuggestion: (canvasItemId: string) => void;
  setFeatureSuggestions: (suggestions: FeatureSuggestion[]) => void;
  addFeatureSuggestions: (suggestions: FeatureSuggestion[]) => void;
  removeFeatureSuggestion: (suggestionId: string) => void;
  markFeatureSuggestionAdded: (suggestionId: string, canvasItemId: string) => void;
  restoreFeatureSuggestion: (canvasItemId: string) => void;
  setStorySuggestions: (suggestions: StorySuggestion[]) => void;
  addStorySuggestions: (suggestions: StorySuggestion[]) => void;
  removeStorySuggestion: (suggestionId: string) => void;
  markStorySuggestionAdded: (suggestionId: string, canvasItemId: string) => void;
  restoreStorySuggestion: (canvasItemId: string) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  currentCanvas: null,
  canvases: [],
  activeField: null,
  messages: [],
  stories: [],
  executionPlan: null,
  conflicts: [],
  benchmarks: [],
  selectedOKRs: [],
  selectedEpics: [],
  selectedFeatures: [],
  jiraProjectId: null,
  availableJiraProjects: [],
  auditLog: [],
  businessRequirements: [],
  epicSuggestions: [],
  featureSuggestions: [],
  storySuggestions: [],
  isGenerating: false,
  isRefining: false,
  isSaving: false,
  isGeneratingEpics: false,
  isGeneratingFeatures: false,
  isGeneratingStories: false,
  isGeneratingExecution: false,
  isDetectingConflicts: false,
  isGeneratingBenchmarks: false,
  isExportingToJira: false,

  setCurrentCanvas: (canvas) => {
    // Load persisted data from canvas
    // We extend the type locally to handle the additional properties that might exist on the object
    // but aren't strictly part of the base BusinessCanvas type yet (or are being migrated)
    type ExtendedCanvas = BusinessCanvas & {
      stories?: Story[];
      executionPlan?: ExecutionPlan | null;
      benchmarks?: Benchmark[];
      auditLog?: AuditLogEntry[];
      businessRequirements?: BusinessRequirement[];
      epicSuggestions?: EpicSuggestion[];
      featureSuggestions?: FeatureSuggestion[];
      storySuggestions?: StorySuggestion[];
    };

    const extendedCanvas = canvas as ExtendedCanvas;

    set({
      currentCanvas: canvas,
      stories: extendedCanvas.stories || [],
      executionPlan: extendedCanvas.executionPlan || null,
      benchmarks: extendedCanvas.benchmarks || [],
      auditLog: extendedCanvas.auditLog || [],
      businessRequirements: extendedCanvas.businessRequirements || [],
      epicSuggestions: extendedCanvas.epicSuggestions || [],
      featureSuggestions: extendedCanvas.featureSuggestions || [],
      storySuggestions: extendedCanvas.storySuggestions || [],
    });
  },

  updateField: (fieldName, field) => {
    const { currentCanvas } = get();
    if (!currentCanvas) return;

    const updatedCanvas: BusinessCanvas = {
      ...currentCanvas,
      [fieldName]: field,
      updatedAt: new Date().toISOString(),
    };

    set({ currentCanvas: updatedCanvas });
  },

  setActiveField: (fieldName) => set({ activeField: fieldName }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  clearMessages: () => set({ messages: [] }),

  setGenerating: (isGenerating) => set({ isGenerating }),

  setRefining: (isRefining) => set({ isRefining }),

  setSaving: (isSaving) => set({ isSaving }),

  createNewCanvas: () => {
    const newCanvas = createEmptyCanvas();
    set({ currentCanvas: newCanvas, messages: [], activeField: null });
  },

  loadCanvases: (canvases) => set({ canvases }),

  updateCanvasStatus: (status) => {
    const { currentCanvas } = get();
    if (!currentCanvas) return;

    const updatedCanvas: BusinessCanvas = {
      ...currentCanvas,
      status,
      updatedAt: new Date().toISOString(),
    };

    set({ currentCanvas: updatedCanvas });
  },

  setStories: (stories) => {
    set({ stories });
    // Auto-save stories to canvas
    const { currentCanvas } = get();
    if (currentCanvas) {
      const updatedCanvas = {
        ...currentCanvas,
        stories,
        updatedAt: new Date().toISOString(),
      };
      set({ currentCanvas: updatedCanvas });
      // Persist to database
      fetch(`/api/canvas/${currentCanvas.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCanvas),
      }).catch((error) => console.error("Failed to auto-save stories:", error));
    }
  },

  addStories: (newStories) => {
    const { stories, currentCanvas } = get();
    // Filter out invalid or duplicate IDs (including duplicates inside the new batch)
    const existingIds = new Set(stories.map((s) => s.id));
    const uniqueNewStories: Story[] = [];
    const seenIds = new Set(existingIds);

    newStories.forEach((story) => {
      if (!story || typeof story.id !== "string") return;
      const trimmedId = story.id.trim();
      if (!trimmedId || seenIds.has(trimmedId)) return;
      seenIds.add(trimmedId);
      uniqueNewStories.push({ ...story, id: trimmedId });
    });

    if (uniqueNewStories.length === 0) return; // Nothing new to add
    const updatedStories = [...stories, ...uniqueNewStories];
    set({ stories: updatedStories });
    // Auto-save stories to canvas
    if (currentCanvas) {
      const updatedCanvas = {
        ...currentCanvas,
        stories: updatedStories,
        updatedAt: new Date().toISOString(),
      };
      set({ currentCanvas: updatedCanvas });
      // Persist to database
      fetch(`/api/canvas/${currentCanvas.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCanvas),
      }).catch((error) => console.error("Failed to auto-save stories:", error));
    }
  },

  updateStory: (storyId, updates) => {
    const { stories, currentCanvas } = get();
    const updatedStories = stories.map((story) =>
      story.id === storyId ? { ...story, ...updates } : story
    );
    set({ stories: updatedStories });
    // Auto-save stories to canvas
    if (currentCanvas) {
      const updatedCanvas = {
        ...currentCanvas,
        stories: updatedStories,
        updatedAt: new Date().toISOString(),
      };
      set({ currentCanvas: updatedCanvas });
      // Persist to database
      fetch(`/api/canvas/${currentCanvas.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCanvas),
      }).catch((error) => console.error("Failed to auto-save stories:", error));
    }
  },

  setSelectedOKRs: (okrIds) => set({ selectedOKRs: okrIds }),

  toggleOKRSelection: (okrId) => {
    const { selectedOKRs } = get();
    const isSelected = selectedOKRs.includes(okrId);
    set({ selectedOKRs: isSelected ? selectedOKRs.filter(id => id !== okrId) : [...selectedOKRs, okrId] });
  },

  setSelectedEpics: (epicIds) => set({ selectedEpics: epicIds }),

  toggleEpicSelection: (epicId) => {
    const { selectedEpics } = get();
    const isSelected = selectedEpics.includes(epicId);
    set({ selectedEpics: isSelected ? selectedEpics.filter(id => id !== epicId) : [...selectedEpics, epicId] });
  },

  setSelectedFeatures: (featureIds) => set({ selectedFeatures: featureIds }),

  toggleFeatureSelection: (featureId) => {
    const { selectedFeatures } = get();
    const isSelected = selectedFeatures.includes(featureId);
    set({ selectedFeatures: isSelected ? selectedFeatures.filter(id => id !== featureId) : [...selectedFeatures, featureId] });
  },

  setGeneratingEpics: (isGeneratingEpics) => set({ isGeneratingEpics }),

  setGeneratingFeatures: (isGeneratingFeatures) => set({ isGeneratingFeatures }),

  setGeneratingStories: (isGeneratingStories) => set({ isGeneratingStories }),

  setExecutionPlan: (executionPlan) => set({ executionPlan }),

  setGeneratingExecution: (isGeneratingExecution) => set({ isGeneratingExecution }),

  setConflicts: (conflicts) => set({ conflicts }),

  setDetectingConflicts: (isDetectingConflicts) => set({ isDetectingConflicts }),

  resolveConflict: (conflictId) => {
    const { conflicts } = get();
    const updatedConflicts = conflicts.map((conflict) =>
      conflict.id === conflictId ? { ...conflict, resolved: true } : conflict
    );
    set({ conflicts: updatedConflicts });
  },

  updateConflictResolution: (conflictId, resolution) => {
    const { conflicts } = get();
    const updatedConflicts = conflicts.map((conflict) =>
      conflict.id === conflictId ? { ...conflict, resolution } : conflict
    );
    set({ conflicts: updatedConflicts });
  },

  setBenchmarks: (benchmarks) => set({ benchmarks }),

  setGeneratingBenchmarks: (isGeneratingBenchmarks) => set({ isGeneratingBenchmarks }),

  setJiraProjectId: (projectId) => set({ jiraProjectId: projectId }),

  setAvailableJiraProjects: (projects) => set({ availableJiraProjects: projects }),

  setExportingToJira: (isExportingToJira) => set({ isExportingToJira }),

  addAuditLogEntry: async (entry) => {
    const { auditLog, currentCanvas } = get();
    const newEntry: AuditLogEntry = {
      ...entry,
      id: `audit-${nanoid(12)}`,
      timestamp: new Date().toISOString(),
      canvasId: currentCanvas?.id || "unknown",
    };
    const updatedAuditLog = [...auditLog, newEntry];
    
    // Update canvas object with audit log so it persists
    if (currentCanvas) {
      const updatedCanvas = {
        ...currentCanvas,
        auditLog: updatedAuditLog,
        updatedAt: new Date().toISOString(),
      };
      set({ 
        auditLog: updatedAuditLog,
        currentCanvas: updatedCanvas,
      });
      
      // Auto-save the canvas with audit log entry
      try {
        await fetch(`/api/canvas/${currentCanvas.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedCanvas),
        });
      } catch (saveError) {
        console.error("Failed to auto-save audit log entry:", saveError);
        // Don't show error to user, they can save manually later
      }
    } else {
      set({ auditLog: updatedAuditLog });
    }
  },

  setBusinessRequirements: (requirements) => {
    set({ businessRequirements: requirements });
    // Auto-save to canvas
    const { currentCanvas, stories, epicSuggestions } = get();
    if (currentCanvas) {
      const updatedCanvas = {
        ...currentCanvas,
        stories,
        businessRequirements: requirements,
        epicSuggestions,
        updatedAt: new Date().toISOString(),
      };
      set({ currentCanvas: updatedCanvas });
      fetch(`/api/canvas/${currentCanvas.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCanvas),
      }).catch((error) => console.error("Failed to auto-save business requirements:", error));
    }
  },

  setEpicSuggestions: (suggestions) => {
    set({ epicSuggestions: suggestions });
    // Auto-save to canvas
    const { currentCanvas, stories, businessRequirements } = get();
    if (currentCanvas) {
      const updatedCanvas = {
        ...currentCanvas,
        stories,
        businessRequirements,
        epicSuggestions: suggestions,
        updatedAt: new Date().toISOString(),
      };
      set({ currentCanvas: updatedCanvas });
      fetch(`/api/canvas/${currentCanvas.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCanvas),
      }).catch((error) => console.error("Failed to auto-save epic suggestions:", error));
    }
  },

  addEpicSuggestions: (newSuggestions) => {
    const { epicSuggestions, currentCanvas, stories, businessRequirements } = get();
    // Filter out duplicates by ID
    const existingIds = new Set(epicSuggestions.map((s) => s.id));
    const uniqueNewSuggestions = newSuggestions.filter((s) => !existingIds.has(s.id));
    if (uniqueNewSuggestions.length === 0) return; // Nothing new to add
    const updatedSuggestions = [...epicSuggestions, ...uniqueNewSuggestions];
    set({ epicSuggestions: updatedSuggestions });
    // Auto-save to canvas
    if (currentCanvas) {
      const updatedCanvas = {
        ...currentCanvas,
        stories,
        businessRequirements,
        epicSuggestions: updatedSuggestions,
        updatedAt: new Date().toISOString(),
      };
      set({ currentCanvas: updatedCanvas });
      fetch(`/api/canvas/${currentCanvas.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCanvas),
      }).catch((error) => console.error("Failed to auto-save epic suggestions:", error));
    }
  },

  removeEpicSuggestion: (suggestionId) => {
    const { epicSuggestions, currentCanvas, stories, businessRequirements, featureSuggestions, storySuggestions } = get();
    const updatedSuggestions = epicSuggestions.filter((s) => s.id !== suggestionId);
    set({ epicSuggestions: updatedSuggestions });
    // Auto-save to canvas
    if (currentCanvas) {
      const updatedCanvas = {
        ...currentCanvas,
        stories,
        businessRequirements,
        epicSuggestions: updatedSuggestions,
        featureSuggestions,
        storySuggestions,
        updatedAt: new Date().toISOString(),
      };
      set({ currentCanvas: updatedCanvas });
      fetch(`/api/canvas/${currentCanvas.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCanvas),
      }).catch((error) => console.error("Failed to auto-save:", error));
    }
  },

  markEpicSuggestionAdded: (suggestionId, canvasItemId) => {
    const { epicSuggestions, currentCanvas, stories, businessRequirements, featureSuggestions, storySuggestions } = get();
    const updatedSuggestions = epicSuggestions.map((s) =>
      s.id === suggestionId ? { ...s, addedToCanvas: true, canvasItemId } : s
    );
    set({ epicSuggestions: updatedSuggestions });
    if (currentCanvas) {
      const updatedCanvas = {
        ...currentCanvas,
        stories,
        businessRequirements,
        epicSuggestions: updatedSuggestions,
        featureSuggestions,
        storySuggestions,
        updatedAt: new Date().toISOString(),
      };
      set({ currentCanvas: updatedCanvas });
      fetch(`/api/canvas/${currentCanvas.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCanvas),
      }).catch((error) => console.error("Failed to auto-save:", error));
    }
  },

  restoreEpicSuggestion: (canvasItemId) => {
    const { epicSuggestions, currentCanvas, stories, businessRequirements, featureSuggestions, storySuggestions } = get();
    const updatedSuggestions = epicSuggestions.map((s) =>
      s.canvasItemId === canvasItemId ? { ...s, addedToCanvas: false, canvasItemId: undefined } : s
    );
    set({ epicSuggestions: updatedSuggestions });
    if (currentCanvas) {
      const updatedCanvas = {
        ...currentCanvas,
        stories,
        businessRequirements,
        epicSuggestions: updatedSuggestions,
        featureSuggestions,
        storySuggestions,
        updatedAt: new Date().toISOString(),
      };
      set({ currentCanvas: updatedCanvas });
      fetch(`/api/canvas/${currentCanvas.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCanvas),
      }).catch((error) => console.error("Failed to auto-save:", error));
    }
  },

  setFeatureSuggestions: (suggestions) => {
    const { currentCanvas, stories, businessRequirements, epicSuggestions, storySuggestions } = get();
    set({ featureSuggestions: suggestions });
    if (currentCanvas) {
      const updatedCanvas = {
        ...currentCanvas,
        stories,
        businessRequirements,
        epicSuggestions,
        featureSuggestions: suggestions,
        storySuggestions,
        updatedAt: new Date().toISOString(),
      };
      set({ currentCanvas: updatedCanvas });
      fetch(`/api/canvas/${currentCanvas.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCanvas),
      }).catch((error) => console.error("Failed to auto-save:", error));
    }
  },

  addFeatureSuggestions: (newSuggestions) => {
    const { featureSuggestions, currentCanvas, stories, businessRequirements, epicSuggestions, storySuggestions } = get();
    // Filter out duplicates by ID
    const existingIds = new Set(featureSuggestions.map((s) => s.id));
    const uniqueNewSuggestions = newSuggestions.filter((s) => !existingIds.has(s.id));
    if (uniqueNewSuggestions.length === 0) return; // Nothing new to add
    const updatedSuggestions = [...featureSuggestions, ...uniqueNewSuggestions];
    set({ featureSuggestions: updatedSuggestions });
    if (currentCanvas) {
      const updatedCanvas = {
        ...currentCanvas,
        stories,
        businessRequirements,
        epicSuggestions,
        featureSuggestions: updatedSuggestions,
        storySuggestions,
        updatedAt: new Date().toISOString(),
      };
      set({ currentCanvas: updatedCanvas });
      fetch(`/api/canvas/${currentCanvas.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCanvas),
      }).catch((error) => console.error("Failed to auto-save:", error));
    }
  },

  removeFeatureSuggestion: (suggestionId) => {
    const { featureSuggestions, currentCanvas, stories, businessRequirements, epicSuggestions, storySuggestions } = get();
    const updatedSuggestions = featureSuggestions.filter((s) => s.id !== suggestionId);
    set({ featureSuggestions: updatedSuggestions });
    if (currentCanvas) {
      const updatedCanvas = {
        ...currentCanvas,
        stories,
        businessRequirements,
        epicSuggestions,
        featureSuggestions: updatedSuggestions,
        storySuggestions,
        updatedAt: new Date().toISOString(),
      };
      set({ currentCanvas: updatedCanvas });
      fetch(`/api/canvas/${currentCanvas.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCanvas),
      }).catch((error) => console.error("Failed to auto-save:", error));
    }
  },

  markFeatureSuggestionAdded: (suggestionId, canvasItemId) => {
    const { featureSuggestions, currentCanvas, stories, businessRequirements, epicSuggestions, storySuggestions } = get();
    const updatedSuggestions = featureSuggestions.map((s) =>
      s.id === suggestionId ? { ...s, addedToCanvas: true, canvasItemId } : s
    );
    set({ featureSuggestions: updatedSuggestions });
    if (currentCanvas) {
      const updatedCanvas = {
        ...currentCanvas,
        stories,
        businessRequirements,
        epicSuggestions,
        featureSuggestions: updatedSuggestions,
        storySuggestions,
        updatedAt: new Date().toISOString(),
      };
      set({ currentCanvas: updatedCanvas });
      fetch(`/api/canvas/${currentCanvas.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCanvas),
      }).catch((error) => console.error("Failed to auto-save:", error));
    }
  },

  restoreFeatureSuggestion: (canvasItemId) => {
    const { featureSuggestions, currentCanvas, stories, businessRequirements, epicSuggestions, storySuggestions } = get();
    const updatedSuggestions = featureSuggestions.map((s) =>
      s.canvasItemId === canvasItemId ? { ...s, addedToCanvas: false, canvasItemId: undefined } : s
    );
    set({ featureSuggestions: updatedSuggestions });
    if (currentCanvas) {
      const updatedCanvas = {
        ...currentCanvas,
        stories,
        businessRequirements,
        epicSuggestions,
        featureSuggestions: updatedSuggestions,
        storySuggestions,
        updatedAt: new Date().toISOString(),
      };
      set({ currentCanvas: updatedCanvas });
      fetch(`/api/canvas/${currentCanvas.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCanvas),
      }).catch((error) => console.error("Failed to auto-save:", error));
    }
  },

  setStorySuggestions: (suggestions) => {
    const { currentCanvas, stories, businessRequirements, epicSuggestions, featureSuggestions } = get();
    set({ storySuggestions: suggestions });
    if (currentCanvas) {
      const updatedCanvas = {
        ...currentCanvas,
        stories,
        businessRequirements,
        epicSuggestions,
        featureSuggestions,
        storySuggestions: suggestions,
        updatedAt: new Date().toISOString(),
      };
      set({ currentCanvas: updatedCanvas });
      fetch(`/api/canvas/${currentCanvas.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCanvas),
      }).catch((error) => console.error("Failed to auto-save:", error));
    }
  },

  addStorySuggestions: (newSuggestions) => {
    const { storySuggestions, currentCanvas, stories, businessRequirements, epicSuggestions, featureSuggestions } = get();
    // Filter out duplicates by ID
    const existingIds = new Set(storySuggestions.map((s) => s.id));
    const uniqueNewSuggestions = newSuggestions.filter((s) => !existingIds.has(s.id));
    if (uniqueNewSuggestions.length === 0) return; // Nothing new to add
    const updatedSuggestions = [...storySuggestions, ...uniqueNewSuggestions];
    set({ storySuggestions: updatedSuggestions });
    if (currentCanvas) {
      const updatedCanvas = {
        ...currentCanvas,
        stories,
        businessRequirements,
        epicSuggestions,
        featureSuggestions,
        storySuggestions: updatedSuggestions,
        updatedAt: new Date().toISOString(),
      };
      set({ currentCanvas: updatedCanvas });
      fetch(`/api/canvas/${currentCanvas.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCanvas),
      }).catch((error) => console.error("Failed to auto-save:", error));
    }
  },

  removeStorySuggestion: (suggestionId) => {
    const { storySuggestions, currentCanvas, stories, businessRequirements, epicSuggestions, featureSuggestions } = get();
    const updatedSuggestions = storySuggestions.filter((s) => s.id !== suggestionId);
    set({ storySuggestions: updatedSuggestions });
    if (currentCanvas) {
      const updatedCanvas = {
        ...currentCanvas,
        stories,
        businessRequirements,
        epicSuggestions,
        featureSuggestions,
        storySuggestions: updatedSuggestions,
        updatedAt: new Date().toISOString(),
      };
      set({ currentCanvas: updatedCanvas });
      fetch(`/api/canvas/${currentCanvas.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCanvas),
      }).catch((error) => console.error("Failed to auto-save:", error));
    }
  },

  markStorySuggestionAdded: (suggestionId, canvasItemId) => {
    const { storySuggestions, currentCanvas, stories, businessRequirements, epicSuggestions, featureSuggestions } = get();
    const updatedSuggestions = storySuggestions.map((s) =>
      s.id === suggestionId ? { ...s, addedToCanvas: true, canvasItemId } : s
    );
    set({ storySuggestions: updatedSuggestions });
    if (currentCanvas) {
      const updatedCanvas = {
        ...currentCanvas,
        stories,
        businessRequirements,
        epicSuggestions,
        featureSuggestions,
        storySuggestions: updatedSuggestions,
        updatedAt: new Date().toISOString(),
      };
      set({ currentCanvas: updatedCanvas });
      fetch(`/api/canvas/${currentCanvas.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCanvas),
      }).catch((error) => console.error("Failed to auto-save:", error));
    }
  },

  restoreStorySuggestion: (canvasItemId) => {
    const { storySuggestions, currentCanvas, stories, businessRequirements, epicSuggestions, featureSuggestions } = get();
    const updatedSuggestions = storySuggestions.map((s) =>
      s.canvasItemId === canvasItemId ? { ...s, addedToCanvas: false, canvasItemId: undefined } : s
    );
    set({ storySuggestions: updatedSuggestions });
    if (currentCanvas) {
      const updatedCanvas = {
        ...currentCanvas,
        stories,
        businessRequirements,
        epicSuggestions,
        featureSuggestions,
        storySuggestions: updatedSuggestions,
        updatedAt: new Date().toISOString(),
      };
      set({ currentCanvas: updatedCanvas });
      fetch(`/api/canvas/${currentCanvas.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedCanvas),
      }).catch((error) => console.error("Failed to auto-save:", error));
    }
  },
}));
