"use client";

import * as React from "react";
import { CanvasCard } from "./canvas-card";
import { StoriesTab } from "./stories-tab";
import { ResearchTab } from "./research-tab";
import { BRDTab } from "./brd-tab";
import { HeaderField } from "./header-field";
import { FieldItem } from "./field-item";
import { renderFieldValueWithStyle } from "./field-value-renderer";
import type { DisplayStyle, FieldAccessLevel } from "@/lib/validators/settings-schema";
import { useCanvasHandlers } from "@/hooks/use-canvas-handlers";
import { useCanvasStore } from "@/stores/canvas-store";
import { getFieldLabel } from "@/lib/utils/canvas-helpers";
import { isFieldRelevant } from "@/lib/utils/field-relevance";
import { ChevronDown, Sparkles, Calendar, Users, DollarSign, Wrench, Server, Eye, EyeOff, BarChart3, TrendingUp, TrendingDown, Minus, Loader2, Pencil, Save, X, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { BusinessCanvas, CanvasField } from "@/lib/validators/canvas-schema";
import type { UserPresence } from "@/hooks/use-collaboration";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LiveCursors } from "@/components/collaboration";

/**
 * Mini avatar display for showing which users are on a specific tab
 */
function TabAvatars({ users, tab }: { users: UserPresence[]; tab: string }) {
  const usersOnTab = users.filter((u) => u.currentTab === tab);

  if (usersOnTab.length === 0) return null;

  const maxVisible = 3;
  const visibleUsers = usersOnTab.slice(0, maxVisible);
  const remainingCount = usersOnTab.length - maxVisible;

  return (
    <TooltipProvider>
      <div className="flex items-center -space-x-1.5 ml-1">
        {visibleUsers.map((user) => (
          <Tooltip key={user.clientId || user.id}>
            <TooltipTrigger asChild>
              <div
                className="h-5 w-5 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-medium text-white"
                style={{ backgroundColor: user.color }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {user.name}
            </TooltipContent>
          </Tooltip>
        ))}
        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="h-5 w-5 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium">
                +{remainingCount}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {usersOnTab.slice(maxVisible).map((u) => u.name).join(", ")}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

interface CanvasGridProps {
  canvas: BusinessCanvas;
  viewMode?: "tile" | "table";
  commentCounts?: Record<string, number>;
  onOpenComments?: (fieldKey: string) => void;
  onFieldConfigLoaded?: (fieldConfig: Array<{
    id: string;
    name: string;
    fieldKey: string;
    enabled: boolean;
    includeInGeneration?: boolean;
    order: number;
    type: string;
    description?: string;
  }>) => void;
  /** Other users currently viewing this canvas */
  collaborators?: UserPresence[];
  /** Callback to update current user's presence (e.g., which tab they're on) */
  onPresenceUpdate?: (update: Partial<Pick<UserPresence, "currentTab" | "activeField" | "action">>) => void;
  /** Callback when the active tab changes */
  onTabChange?: (tab: string) => void;
  /** Controlled active tab (for follow mode) */
  activeTab?: string;
  /** Whether to check MCP connectivity (admin-only to avoid unnecessary 429s) */
  enableMcpCheck?: boolean;
  /** Team ID of the current user for availability resolution */
  userTeamId: string | null;
  /** Current user's role (used for role-based availability) */
  userRole?: string | null;
  /** Sharing role on this canvas (owner/editor/viewer) */
  permissionRole?: "owner" | "editor" | "viewer" | null;
  /** Whether collaboration features are enabled */
  isCollabEnabled?: boolean;
}

/**
 * Displays all canvas fields in a responsive grid layout
 */
export function CanvasGrid({
  canvas: canvasProp,
  viewMode = "tile",
  commentCounts = {},
  onOpenComments,
  onFieldConfigLoaded,
  collaborators = [],
  onPresenceUpdate,
  onTabChange,
  activeTab: controlledActiveTab,
  enableMcpCheck = true,
  userTeamId,
  userRole = null,
  permissionRole = null,
  isCollabEnabled = false,
}: CanvasGridProps): React.ReactElement {
  const currentCanvas = useCanvasStore((state) => state.currentCanvas);
  const stories = useCanvasStore((state) => state.stories);
  const executionPlan = useCanvasStore((state) => state.executionPlan);
  const isGeneratingExecution = useCanvasStore((state) => state.isGeneratingExecution);
  const benchmarks = useCanvasStore((state) => state.benchmarks);
  const isGeneratingBenchmarks = useCanvasStore((state) => state.isGeneratingBenchmarks);
  const addAuditLogEntry = useCanvasStore((state) => state.addAuditLogEntry);
  const setBenchmarksStore = useCanvasStore((state) => state.setBenchmarks);
  const [isJiraConnected, setIsJiraConnected] = React.useState(false);
  const [isExportingToJira, setIsExportingToJira] = React.useState(false);
  const [showAllFields, setShowAllFields] = React.useState(false);
  const [industry, setIndustry] = React.useState<string>("other");
  const [internalActiveTab, setInternalActiveTab] = React.useState("canvas");
  const hasCheckedMcp = React.useRef(false);
  const [fieldAvailability, setFieldAvailability] = React.useState<Array<{
    fieldKey: string;
    roleAccess?: Record<string, FieldAccessLevel>;
    teamAccess?: Record<string, FieldAccessLevel>;
  }>>([]);
  const [isAvailabilityLoaded, setIsAvailabilityLoaded] = React.useState(false);
  const [benchmarksDraft, setBenchmarksDraft] = React.useState(benchmarks);
  const [isEditingBenchmarks, setIsEditingBenchmarks] = React.useState(false);
  const [isSavingBenchmarks, setIsSavingBenchmarks] = React.useState(false);
  const [isRefiningBenchmarks, setIsRefiningBenchmarks] = React.useState(false);
  const [benchmarksInstruction, setBenchmarksInstruction] = React.useState("");
  const setCurrentCanvas = useCanvasStore((state) => state.setCurrentCanvas);
  const canEditCanvas =
    userRole === "admin" ||
    permissionRole === "owner" ||
    permissionRole === "editor";
  const isSharedCanvas = permissionRole !== null;

  // Use canvas from store if available, otherwise use prop
  const canvas = currentCanvas || canvasProp;

  // Use controlled tab if provided, otherwise use internal state
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const setActiveTab = (tab: string) => {
    setInternalActiveTab(tab);
    onTabChange?.(tab);
  };
  const [fieldConfig, setFieldConfig] = React.useState<Array<{
    id: string;
    name: string;
    fieldKey: string;
    enabled: boolean;
    includeInGeneration?: boolean;
    order: number;
    type: string;
  }>>([]);

  React.useEffect(() => {
    setBenchmarksDraft(benchmarks);
  }, [benchmarks]);

  const {
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
  } = useCanvasHandlers({ canvas });
  const handleExportToJiraWithState = async (): Promise<void> => {
    setIsExportingToJira(true);
    try {
      await handleExportToJira();
    } finally {
      setIsExportingToJira(false);
    }
  };
  const handleGenerateBenchmarksWithIndustry = (): Promise<void> => handleGenerateBenchmarks(industry);
  const handleStartBenchmarksEdit = () => {
    setBenchmarksDraft(benchmarksDraft.length ? benchmarksDraft : benchmarks);
    setIsEditingBenchmarks(true);
  };
  const handleCancelBenchmarksEdit = () => {
    setBenchmarksDraft(benchmarks);
    setIsEditingBenchmarks(false);
    setBenchmarksInstruction("");
  };
  const handleAddBenchmark = () => {
    setBenchmarksDraft((prev) => [
      ...prev,
      {
        metric: "",
        yourValue: "",
        industryAverage: "",
        topPerformers: "",
        assessment: "at",
        recommendation: "",
      },
    ]);
    setIsEditingBenchmarks(true);
  };
  const handleDeleteBenchmark = (index: number) => {
    setBenchmarksDraft((prev) => prev.filter((_, idx) => idx !== index));
  };
  const handleUpdateBenchmark = <K extends keyof typeof benchmarksDraft[number]>(
    index: number,
    key: K,
    value: (typeof benchmarksDraft[number])[K]
  ) => {
    setBenchmarksDraft((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };
  const handleSaveBenchmarks = async () => {
    setIsSavingBenchmarks(true);
    const normalized = benchmarksDraft.map((b) => ({
      ...b,
      assessment: b.assessment || "at",
    }));
    try {
      const response = await fetch("/api/canvas/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId: canvas.id,
          updates: { benchmarks: normalized },
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save benchmarks");
      }
      setBenchmarksStore(normalized);
      setBenchmarksDraft(normalized);
      setIsEditingBenchmarks(false);
      const updatedCanvas = {
        ...(currentCanvas || canvas),
        benchmarks: normalized,
        updatedAt: new Date().toISOString(),
      };
      setCurrentCanvas(updatedCanvas);
      await addAuditLogEntry({
        canvasId: canvas.id,
        action: "edit_field",
        description: "Edited benchmarks",
        metadata: { fieldKey: "benchmarks" },
      });
      toast.success("Benchmarks saved");
    } catch (error) {
      console.error("Failed to save benchmarks:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save benchmarks");
    } finally {
      setIsSavingBenchmarks(false);
    }
  };
  const handleRefineBenchmarks = async () => {
    if (!benchmarksInstruction.trim()) {
      toast.error("Add an instruction for the AI first.");
      return;
    }
    setIsRefiningBenchmarks(true);
    try {
      const response = await fetch("/api/canvas/refine-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId: canvas.id,
          fieldKey: "benchmarks",
          instruction: benchmarksInstruction,
          currentValue: benchmarksDraft.length ? benchmarksDraft : benchmarks,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to refine benchmarks");
      }
      const data = await response.json();
      const refined = Array.isArray(data.value) ? data.value : data.value?.benchmarks || [];
      setBenchmarksDraft(refined);
      setIsEditingBenchmarks(true);
      toast.success("AI refined benchmarks. Review and save.");
      await addAuditLogEntry({
        canvasId: canvas.id,
        action: "refine_field",
        description: "AI refined benchmarks",
        metadata: { fieldKey: "benchmarks", instruction: benchmarksInstruction },
      });
    } catch (error) {
      console.error("Failed to refine benchmarks:", error);
      toast.error(error instanceof Error ? error.message : "Failed to refine benchmarks");
    } finally {
      setIsRefiningBenchmarks(false);
    }
  };
  // Fetch field configuration (global + team custom fields)
  React.useEffect(() => {
    const fetchFieldConfig = async (): Promise<void> => {
      try {
        // Fetch industry from settings (admin only)
        const settingsResponse = await fetch("/api/settings");
        if (settingsResponse.ok) {
          const settings = await settingsResponse.json();
          if (settings?.industry) {
            setIndustry(settings.industry);
          }
        }

        // Fetch field configuration (available to all authenticated users)
        const fieldsResponse = await fetch("/api/settings/fields");
        if (fieldsResponse.ok) {
          const data = await fieldsResponse.json();
          const allFields = data.fields || [];
          if (data.availability) {
            setFieldAvailability(normalizeAvailability(data.availability));
          }
          setIsAvailabilityLoaded(true);

          setFieldConfig(allFields);

          // Notify parent component
          if (onFieldConfigLoaded) {
            onFieldConfigLoaded(allFields);
          }
        } else {
          console.error("Failed to fetch field configuration:", fieldsResponse.status);
        }
      } catch (error) {
        console.error("Failed to fetch field configuration:", error);
        setIsAvailabilityLoaded(true);
      }
    };
    fetchFieldConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check if Jira MCP is connected
  React.useEffect(() => {
    if (!enableMcpCheck || hasCheckedMcp.current) return;
    hasCheckedMcp.current = true;

    const checkJiraConnection = async () => {
      try {
        const response = await fetch("/api/mcp");
        const servers = await response.json();

        // Ensure servers is an array
        if (Array.isArray(servers)) {
          const jiraServer = servers.find(
            (s: { name: string; enabled: boolean }) =>
              s.name.toLowerCase().includes("jira") && s.enabled
          );
          setIsJiraConnected(!!jiraServer);
        }
      } catch (error) {
        console.error("Failed to check Jira connection:", error);
      }
    };
    checkJiraConnection();
  }, [enableMcpCheck]);

  const fieldConfigMap = React.useMemo(() => {
    return new Map(fieldConfig.map((field) => [field.fieldKey, field]));
  }, [fieldConfig]);

  const isFieldPopulated = (field: CanvasField<unknown>): boolean => {
    const value = field?.value;
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
    return true;
  };

  const normalizeAccessLevel = React.useCallback(
    (value?: FieldAccessLevel | null): "hidden" | "read" | "edit" => {
      if (value === "hidden") return "hidden";
      if (value === "read") return "read";
      // Treat legacy/unknown values (including "required") as editable to avoid blocking users
      return "edit";
    },
    []
  );

  const combineAccessLevels = React.useCallback(
    (levels: Array<FieldAccessLevel | undefined>): "hidden" | "read" | "edit" => {
      const normalized = levels
        .filter((lvl) => lvl !== undefined)
        .map((lvl) => normalizeAccessLevel(lvl as FieldAccessLevel));

      if (normalized.includes("hidden")) return "hidden";
      if (normalized.includes("read")) return "read";
      return "edit";
    },
    [normalizeAccessLevel]
  );

  const normalizeAvailability = React.useCallback(
    (
      availability: Array<{
        fieldKey: string;
        roleAccess?: Record<string, FieldAccessLevel>;
        teamAccess?: Record<string, FieldAccessLevel>;
      }>
    ) => {
      return availability.map((entry) => ({
        fieldKey: entry.fieldKey,
        roleAccess: entry.roleAccess
          ? Object.fromEntries(
              Object.entries(entry.roleAccess).map(([key, value]) => [
                key,
                normalizeAccessLevel(value),
              ])
            )
          : undefined,
        teamAccess: entry.teamAccess
          ? Object.fromEntries(
              Object.entries(entry.teamAccess).map(([key, value]) => [
                key,
                normalizeAccessLevel(value),
              ])
            )
          : undefined,
      }));
    },
    [normalizeAccessLevel]
  );

  const getRoleAccessForField = React.useCallback(
    (fieldKey: string): "hidden" | "read" | "edit" | undefined => {
      if (!userRole) return undefined;
      const entry = fieldAvailability.find((a) => a.fieldKey === fieldKey);
      const level = entry?.roleAccess?.[userRole];
      return level ? normalizeAccessLevel(level) : undefined;
    },
    [fieldAvailability, normalizeAccessLevel, userRole]
  );

  const getTeamAccessForField = React.useCallback(
    (fieldKey: string): "hidden" | "read" | "edit" | undefined => {
      if (!isAvailabilityLoaded) return undefined;
      if (!userTeamId) return undefined; // No team: falls back to defaults
      const entry = fieldAvailability.find((a) => a.fieldKey === fieldKey);
      if (!entry?.teamAccess) return undefined;
      const level = entry.teamAccess[userTeamId];
      return level ? normalizeAccessLevel(level) : undefined;
    },
    [fieldAvailability, isAvailabilityLoaded, normalizeAccessLevel, userTeamId]
  );

  const getEffectiveAccess = React.useCallback(
    (fieldKey: string): { access: "hidden" | "read" | "edit"; label: string | null } => {
      // Shared canvases: keep everyone in sync. Owner/editor can edit; viewers read-only.
      if (isSharedCanvas) {
        return {
          access: canEditCanvas ? "edit" : "read",
          label: canEditCanvas ? null : "Read-only (shared canvas)",
        };
      }

      if (userRole === "admin") {
        return { access: "edit", label: null };
      }

      const roleAccess = getRoleAccessForField(fieldKey);
      const teamAccess = getTeamAccessForField(fieldKey);
      const combined = combineAccessLevels([roleAccess, teamAccess]);

      if (combined === "hidden") {
        if (teamAccess === "hidden") return { access: "hidden", label: "Hidden for your team" };
        if (roleAccess === "hidden") return { access: "hidden", label: "Hidden for your role" };
        return { access: "hidden", label: "Hidden" };
      }

      if (combined === "read") {
        if (teamAccess === "read") return { access: "read", label: "Read-only for your team" };
        if (roleAccess === "read") return { access: "read", label: "Read-only for your role" };
        return { access: "read", label: "Read-only" };
      }

      return { access: "edit", label: null };
    },
    [canEditCanvas, combineAccessLevels, getRoleAccessForField, getTeamAccessForField, isSharedCanvas, userRole]
  );

  const canvasFields = React.useMemo(() => {
    const entries = Object.entries(canvas)
      .filter(([, val]) => val && typeof val === "object" && "value" in (val as Record<string, unknown>))
      .map(([key, field]) => ({
        key,
        field: field as CanvasField<unknown>,
        config: fieldConfigMap.get(key),
      }))
      .filter(({ config }) => config?.enabled !== false);

    return entries.sort((a, b) => {
      const orderA = a.config?.order ?? 0;
      const orderB = b.config?.order ?? 0;
      return orderA - orderB;
    });
  }, [canvas, fieldConfigMap]);

  // Header fields are displayed separately at the top, so exclude them from the grid
  const headerFieldKeys = ["title", "problemStatement", "solutionRecommendation"];

  const mainFields = canvasFields.filter(
    ({ key, config }) =>
      config?.type !== "custom" &&
      (config?.includeInGeneration ?? true) &&
      !headerFieldKeys.includes(String(key))
  );
  const optionalFields = canvasFields.filter(
    ({ key, config }) =>
      config?.type !== "custom" &&
      config?.includeInGeneration === false &&
      !headerFieldKeys.includes(String(key))
  );
  const populatedOptionalFields = optionalFields.filter(({ field }) => isFieldPopulated(field));
  const displayedOptionalFields = showAllFields
    ? populatedOptionalFields
    : populatedOptionalFields.filter(({ key }) => isFieldRelevant(String(key), industry, 4));
  const hiddenFieldsCount = populatedOptionalFields.length - displayedOptionalFields.length;
  const hiddenFields = populatedOptionalFields
    .filter((fieldEntry) => !displayedOptionalFields.includes(fieldEntry))
    .map(({ key }) => key);
  const customFields = canvasFields.filter(
    ({ config, field }) => config?.type === "custom" && isFieldPopulated(field)
  );

  const sortByValueThenOrder = <T extends { field: CanvasField<unknown>; config?: { order?: number } }>(
    list: T[]
  ) => {
    return [...list].sort((a, b) => {
      const aHas = isFieldPopulated(a.field);
      const bHas = isFieldPopulated(b.field);
      if (aHas !== bHas) return aHas ? -1 : 1;
      const orderA = a.config?.order ?? 0;
      const orderB = b.config?.order ?? 0;
      return orderA - orderB;
    });
  };

  const mainFieldsSorted = sortByValueThenOrder(mainFields);
  const optionalFieldsSorted = sortByValueThenOrder(optionalFields);
  const displayedOptionalSorted = sortByValueThenOrder(displayedOptionalFields);
  const customFieldsSorted = sortByValueThenOrder(customFields);

  const withAccess = (entries: typeof mainFields) =>
    entries
      .map((entry) => {
        const { access, label } = getEffectiveAccess(String(entry.key));
        return { ...entry, access, accessLabel: label };
      })
      .filter((entry) => {
        // Shared canvases show all fields to keep everyone in sync
        if (isSharedCanvas) return true;
        return entry.access !== "hidden";
      });

  const mainFieldsWithAccess = withAccess(mainFieldsSorted);
  const optionalFieldsWithAccess = withAccess(
    showAllFields ? optionalFieldsSorted : displayedOptionalSorted
  );
  const customFieldsWithAccess = withAccess(customFieldsSorted);

  const SolutionRecommendationSection = ({ canvas }: { canvas: BusinessCanvas }): React.ReactElement | null => {
    const [isActionsExpanded, setIsActionsExpanded] = React.useState(false);

    if (!canvas.solutionRecommendation) return null;

    return (
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-primary">Solution Recommendation</h2>
        <div className="space-y-3">
          <p className="text-base leading-relaxed">{String(canvas.solutionRecommendation.value)}</p>
          {canvas.solutionRecommendation.actions && canvas.solutionRecommendation.actions.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsActionsExpanded(!isActionsExpanded);
                }}
                className="group flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform group-hover:text-primary",
                    isActionsExpanded && "rotate-180"
                  )}
                />
                <span>View {canvas.solutionRecommendation.actions.length} action{canvas.solutionRecommendation.actions.length !== 1 && "s"}</span>
              </button>

              {isActionsExpanded && (
                <div className="mt-3">
                  <ul className="space-y-2">
                    {canvas.solutionRecommendation.actions.map((action, index) => {
                      const isString = typeof action === "string";
                      return (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          {!isString && action.priority && (
                            <Badge variant="outline" className="text-xs">
                              {action.priority}
                            </Badge>
                          )}
                          <span className="flex-1">
                            {isString ? action : action.action}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (viewMode === "table") {
    return (
      <div className="space-y-8">
        {isCollabEnabled && (
          <LiveCursors
            users={collaborators}
            currentTab={activeTab}
            hiddenFieldKeys={
              new Set([
                ...mainFields
                  .filter(({ key }) => getEffectiveAccess(String(key)).access === "hidden")
                  .map(({ key }) => String(key)),
                ...optionalFields
                  .filter(({ key }) => getEffectiveAccess(String(key)).access === "hidden")
                  .map(({ key }) => String(key)),
                ...customFields
                  .filter(({ key }) => getEffectiveAccess(String(key)).access === "hidden")
                  .map(({ key }) => String(key)),
              ])
            }
          />
        )}
        <div className="space-y-6">
          <HeaderField
            fieldKey="title"
            field={canvas.title}
            isTitle
            commentCount={commentCounts.title}
            onEditField={handleEditField}
            onQuickEdit={(instruction) => handleQuickEdit("title", instruction)}
            onSaveCanvas={(value) => handleAcceptEdit("title", value)}
            onOpenComments={onOpenComments}
          />
          <HeaderField
            fieldKey="problemStatement"
            field={canvas.problemStatement}
            commentCount={commentCounts.problemStatement}
            onEditField={handleEditField}
            onQuickEdit={(instruction) => handleQuickEdit("problemStatement", instruction)}
            onSaveCanvas={(value) => handleAcceptEdit("problemStatement", value)}
            onOpenComments={onOpenComments}
          />

          <SolutionRecommendationSection canvas={canvas} />
        </div>

        <Separator className="my-8" />

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value);
            onPresenceUpdate?.({ currentTab: value });
          }}
          className="w-full"
        >
          <TabsList>
            <TabsTrigger value="canvas" className="gap-1.5">
              Canvas
              <TabAvatars users={collaborators} tab="canvas" />
            </TabsTrigger>
            <TabsTrigger value="benchmarks" className="gap-1.5">
              Benchmarks
              <TabAvatars users={collaborators} tab="benchmarks" />
            </TabsTrigger>
            <TabsTrigger value="research" className="gap-1.5">
              Research
              <TabAvatars users={collaborators} tab="research" />
            </TabsTrigger>
            <TabsTrigger value="stories" className="gap-1.5">
              Epics
              <TabAvatars users={collaborators} tab="stories" />
            </TabsTrigger>
            <TabsTrigger value="execution" className="gap-1.5">
              Execution
              <TabAvatars users={collaborators} tab="execution" />
            </TabsTrigger>
            <TabsTrigger value="brd" className="gap-1.5">
              BRD
              <TabAvatars users={collaborators} tab="brd" />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="canvas" className="mt-6">
            <div className="space-y-4">
              {hiddenFieldsCount > 0 && (
                <div className="rounded-lg bg-muted/30 border">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      {showAllFields ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {showAllFields
                            ? `Showing all ${populatedOptionalFields.length} optional fields`
                            : `Showing ${displayedOptionalFields.length} of ${populatedOptionalFields.length} optional fields`}
                        </p>
                        {!showAllFields && hiddenFieldsCount > 0 && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5">
                            {hiddenFieldsCount} less relevant {hiddenFieldsCount === 1 ? 'field is' : 'fields are'} hidden for {industry === "other" ? "general" : industry} industry
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllFields(!showAllFields)}
                    >
                      {showAllFields ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-2" />
                          Show Relevant Only
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-2" />
                          Show All Fields
                        </>
                      )}
                    </Button>
                  </div>
                  {!showAllFields && hiddenFields.length > 0 && (
                    <div className="px-3 pb-3 pt-0">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-xs text-muted-foreground">Hidden:</span>
                        {hiddenFields.map((fieldKey) => (
                          <Badge
                            key={String(fieldKey)}
                            variant="secondary"
                            className="text-xs"
                          >
                            {getFieldLabel(String(fieldKey))}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="columns-1 lg:columns-2 gap-2">
                {mainFieldsWithAccess.map(({ key, field, config, access, accessLabel }) => (
                  <FieldItem
                    key={String(key)}
                    fieldKey={String(key)}
                    field={field}
                    renderValue={(value) => renderFieldValueWithStyle(value, ((config as { displayStyle?: DisplayStyle })?.displayStyle) || "auto")}
                    onRefine={handleEditField}
                    onQuickEdit={handleQuickEdit}
                    onAcceptEdit={handleAcceptEdit}
                    onOpenComments={onOpenComments}
                    commentCount={commentCounts[String(key)] ?? 0}
                    onPresenceUpdate={onPresenceUpdate}
                    access={access === "read" ? "read" : "edit"}
                    accessLabel={accessLabel}
                    onGenerate={handleEditField}
                  />
                ))}

                {optionalFieldsWithAccess.map(({ key, field, config, access, accessLabel }) => (
                  <FieldItem
                    key={String(key)}
                    fieldKey={String(key)}
                    field={field}
                    renderValue={(value) => renderFieldValueWithStyle(value, ((config as { displayStyle?: DisplayStyle })?.displayStyle) || "auto")}
                    onRefine={handleEditField}
                    onQuickEdit={handleQuickEdit}
                    onAcceptEdit={handleAcceptEdit}
                    onOpenComments={onOpenComments}
                    commentCount={commentCounts[String(key)] ?? 0}
                    onPresenceUpdate={onPresenceUpdate}
                    access={access === "read" ? "read" : "edit"}
                    accessLabel={accessLabel}
                    onGenerate={handleEditField}
                  />
                ))}

                {customFieldsWithAccess.map(({ key, field, config, access, accessLabel }) => (
                  <FieldItem
                    key={String(key)}
                    fieldKey={String(key)}
                    field={field}
                    renderValue={(value) => renderFieldValueWithStyle(value, ((config as { displayStyle?: DisplayStyle })?.displayStyle) || "auto")}
                    onRefine={handleEditField}
                    onQuickEdit={handleQuickEdit}
                    onAcceptEdit={handleAcceptEdit}
                    onOpenComments={onOpenComments}
                    commentCount={commentCounts[String(key)] ?? 0}
                    onPresenceUpdate={onPresenceUpdate}
                    access={access === "read" ? "read" : "edit"}
                    accessLabel={accessLabel}
                    onGenerate={handleEditField}
                  />
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="stories" className="mt-6">
            <StoriesTab
              canvas={canvas}
              isJiraConnected={isJiraConnected}
              isExportingToJira={isExportingToJira}
              onClearStories={handleClearStories}
              onExportToJira={handleExportToJiraWithState}
              onGenerateEpics={handleGenerateEpics}
              onGenerateFeatures={handleGenerateFeatures}
              onGenerateUserStories={handleGenerateUserStories}
            />
          </TabsContent>

          <TabsContent value="execution" className="mt-6">
            {!executionPlan ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <p className="text-muted-foreground mb-4">
                  {isGeneratingExecution ? "Generating execution plan..." : "No execution plan generated yet"}
                </p>
                <p className="text-sm text-muted-foreground mb-6 max-w-md">
                  Generate a comprehensive execution plan including sprint schedules and resource allocation based on your canvas and stories.
                </p>
                <Button
                  onClick={handleGenerateExecution}
                  disabled={isGeneratingExecution || stories.length === 0}
                >
                  {isGeneratingExecution ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Execution Plan
                    </>
                  )}
                </Button>
                {stories.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Generate stories first to create an execution plan
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                {/* Sprints Section */}
                {executionPlan.sprints && executionPlan.sprints.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-semibold">Sprint Plan</h3>
                      <Badge variant="outline" className="ml-2">
                        {executionPlan.sprints.length} sprints
                      </Badge>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {executionPlan.sprints.map((sprint) => (
                        <div
                          key={sprint.id}
                          className="border rounded-lg p-5 bg-card hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-base">{sprint.name}</h4>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(sprint.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} - {new Date(sprint.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                            {sprint.velocity && (
                              <Badge variant="secondary">
                                {sprint.velocity} pts
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">{sprint.goal}</p>
                          <div className="flex items-center gap-4 text-xs">
                            <div>
                              <span className="text-muted-foreground">Capacity:</span>{" "}
                              <span className="font-medium">{sprint.capacity} pts</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Stories:</span>{" "}
                              <span className="font-medium">{sprint.stories.length}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resources Section */}
                {executionPlan.resources && executionPlan.resources.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-semibold">Resources</h3>
                      <Badge variant="outline" className="ml-2">
                        {executionPlan.resources.length} items
                      </Badge>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {executionPlan.resources.map((resource) => {
                        const icon = resource.type === "people"
                          ? Users
                          : resource.type === "budget"
                          ? DollarSign
                          : resource.type === "tools"
                          ? Wrench
                          : Server;
                        const Icon = icon;

                        return (
                          <div
                            key={resource.id}
                            className="border rounded-lg p-5 bg-card hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start gap-3 mb-3">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Icon className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <h4 className="font-semibold text-sm">{resource.name}</h4>
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {resource.type}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{resource.description}</p>
                              </div>
                            </div>
                            <div className="space-y-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">Allocation:</span>{" "}
                                <span className="font-medium">{resource.allocation}</span>
                              </div>
                              {resource.cost && (
                                <div>
                                  <span className="text-muted-foreground">Cost:</span>{" "}
                                  <span className="font-medium">{resource.cost}</span>
                                </div>
                              )}
                              {resource.timeline && (
                                <div>
                                  <span className="text-muted-foreground">Timeline:</span>{" "}
                                  <span className="font-medium">{resource.timeline}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="benchmarks" className="mt-6">
            {(isEditingBenchmarks ? benchmarksDraft : benchmarks).length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <p className="text-muted-foreground mb-4">
                  {isGeneratingBenchmarks ? "Generating benchmarks..." : "No benchmarks generated yet"}
                </p>
                <p className="text-sm text-muted-foreground mb-6 max-w-md">
                  Compare your project against {industry === "other" ? "industry" : industry} standards using Claude&apos;s knowledge. Get insights on timeline, budget, team size, and success metrics.
                </p>
                <Button
                  onClick={handleGenerateBenchmarksWithIndustry}
                  disabled={isGeneratingBenchmarks}
                >
                  {isGeneratingBenchmarks ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Generate Benchmarks
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={handleStartBenchmarksEdit}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add benchmarks manually
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Industry Benchmarks</h3>
                    <Badge variant="outline" className="ml-2">
                      {industry === "other" ? "General" : industry}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    {isEditingBenchmarks ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelBenchmarksEdit}
                          disabled={isSavingBenchmarks}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveBenchmarks}
                          disabled={isSavingBenchmarks}
                        >
                          {isSavingBenchmarks ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Save benchmarks
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleStartBenchmarksEdit}
                        className="gap-1"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>

                <Card className="border-dashed bg-muted/30">
                  <div className="p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">Ask AI to refine benchmarks</p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBenchmarksInstruction("")}
                        >
                          Clear
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleRefineBenchmarks}
                          disabled={isRefiningBenchmarks || !benchmarksInstruction.trim()}
                          className="gap-1"
                        >
                          {isRefiningBenchmarks ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Refining...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Ask AI
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      value={benchmarksInstruction}
                      onChange={(e) => setBenchmarksInstruction(e.target.value)}
                      placeholder="e.g., tighten the assessments and add a benchmark on uptime SLAs."
                      rows={3}
                    />
                  </div>
                </Card>

                {/* Benchmarks Grid */}
                <div className="grid gap-4">
                  {(isEditingBenchmarks ? benchmarksDraft : benchmarks).map((benchmark, index) => {
                    const AssessmentIcon =
                      benchmark.assessment === "above"
                        ? TrendingUp
                        : benchmark.assessment === "below"
                        ? TrendingDown
                        : Minus;

                    const assessmentColor =
                      benchmark.assessment === "above"
                        ? "text-green-600 dark:text-green-400"
                        : benchmark.assessment === "below"
                        ? "text-red-600 dark:text-red-400"
                        : "text-yellow-600 dark:text-yellow-400";

                    if (isEditingBenchmarks) {
                      return (
                        <div
                          key={`bench-${index}`}
                          className="border rounded-lg p-5 bg-card"
                        >
                          <div className="grid gap-4 md:grid-cols-[1.2fr,1fr,1fr,1fr,auto] items-start">
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">Metric</p>
                              <Input
                                value={benchmark.metric}
                                onChange={(e) => handleUpdateBenchmark(index, "metric", e.target.value)}
                                placeholder="Cycle time"
                              />
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">Your Value</p>
                              <Input
                                value={benchmark.yourValue}
                                onChange={(e) => handleUpdateBenchmark(index, "yourValue", e.target.value)}
                                placeholder="12 days"
                              />
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">Industry Average</p>
                              <Input
                                value={benchmark.industryAverage}
                                onChange={(e) => handleUpdateBenchmark(index, "industryAverage", e.target.value)}
                                placeholder="9 days"
                              />
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">Top Performers</p>
                              <Input
                                value={benchmark.topPerformers}
                                onChange={(e) => handleUpdateBenchmark(index, "topPerformers", e.target.value)}
                                placeholder="6 days"
                              />
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">Assessment</p>
                              <Select
                                value={benchmark.assessment || "at"}
                                onValueChange={(val) => handleUpdateBenchmark(index, "assessment", val as typeof benchmark.assessment)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="above">Above</SelectItem>
                                  <SelectItem value="at">At par</SelectItem>
                                  <SelectItem value="below">Below</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-[1fr,auto] items-start">
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Recommendation</p>
                              <Textarea
                                value={benchmark.recommendation || ""}
                                onChange={(e) => handleUpdateBenchmark(index, "recommendation", e.target.value)}
                                placeholder="Focus on automation to reduce cycle time."
                                rows={2}
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive justify-self-end"
                              onClick={() => handleDeleteBenchmark(index)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={`bench-${index}`}
                        className="border rounded-lg p-5 bg-card hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex-1">
                            <h4 className="font-semibold text-base mb-1">{benchmark.metric}</h4>
                            <div className="grid grid-cols-3 gap-4 mt-3">
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground uppercase tracking-wide">Your Value</p>
                                <p className="text-sm font-medium">{benchmark.yourValue}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground uppercase tracking-wide">Industry Average</p>
                                <p className="text-sm font-medium">{benchmark.industryAverage}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground uppercase tracking-wide">Top Performers</p>
                                <p className="text-sm font-medium">{benchmark.topPerformers}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <AssessmentIcon className={cn("h-5 w-5", assessmentColor)} />
                            <Badge
                              variant={
                                benchmark.assessment === "above"
                                  ? "default"
                                  : benchmark.assessment === "below"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className="capitalize"
                            >
                              {benchmark.assessment} average
                            </Badge>
                          </div>
                        </div>
                        {benchmark.recommendation && (
                          <div className="mt-4 pt-4 border-t">
                            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                              Recommendation
                            </p>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {benchmark.recommendation}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {isEditingBenchmarks && (
                    <Button
                      variant="outline"
                      className="w-full border-dashed"
                      onClick={handleAddBenchmark}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add benchmark
                    </Button>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="research" className="mt-6">
            <ResearchTab canvas={canvas} />
          </TabsContent>

          <TabsContent value="brd" className="mt-6">
            <BRDTab canvas={canvas} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {mainFields.map(({ key, field, config }) => (
        <CanvasCard
          key={String(key)}
          title={getFieldLabel(String(key))}
          field={field}
          onEdit={() => handleEditField(String(key))}
          onQuickEdit={(instruction) => handleQuickEdit(key, instruction)}
          onAcceptEdit={(value) => handleAcceptEdit(key, value)}
          onProvideContext={(context) => handleProvideContext(key, context)}
          renderValue={(value) => renderFieldValueWithStyle(value, ((config as { displayStyle?: DisplayStyle })?.displayStyle) || "auto")}
        />
      ))}

      {canvas.solutionRecommendation && (
        <CanvasCard
          title={getFieldLabel("solutionRecommendation")}
          field={{
            value: canvas.solutionRecommendation.value,
            evidence: canvas.solutionRecommendation.evidence,
            confidence: canvas.solutionRecommendation.confidence,
          }}
          onEdit={() => handleEditField("solutionRecommendation")}
          onQuickEdit={(instruction) => handleQuickEdit("solutionRecommendation", instruction)}
          onAcceptEdit={(value) => handleAcceptEdit("solutionRecommendation", value)}
          onProvideContext={(context) => handleProvideContext("solutionRecommendation", context)}
          renderValue={(value) => (
            <div className="space-y-3">
              <p>{String(value)}</p>
              {canvas.solutionRecommendation?.actions && canvas.solutionRecommendation.actions.length > 0 && (
                <div>
                  <p className="font-medium text-sm mb-2">Actions:</p>
                  <ul className="space-y-2">
                    {canvas.solutionRecommendation.actions.map((action, index) => {
                      const isString = typeof action === "string";
                      return (
                        <li key={index} className="flex items-start gap-2">
                          {!isString && action.priority && (
                            <span className="text-xs font-medium uppercase px-2 py-0.5 rounded bg-primary/10 text-primary">
                              {action.priority}
                            </span>
                          )}
                          <span className="flex-1">
                            {isString ? action : action.action}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
          className="md:col-span-2 xl:col-span-3"
        />
      )}

      {populatedOptionalFields.map(({ key, field, config }) => (
        <CanvasCard
          key={String(key)}
          title={getFieldLabel(String(key))}
          field={field}
          onEdit={() => handleEditField(String(key))}
          onQuickEdit={(instruction) => handleQuickEdit(key, instruction)}
          onAcceptEdit={(value) => handleAcceptEdit(key, value)}
          onProvideContext={(context) => handleProvideContext(key, context)}
          renderValue={(value) => renderFieldValueWithStyle(value, ((config as { displayStyle?: DisplayStyle })?.displayStyle) || "auto")}
          className="md:col-span-2 xl:col-span-3"
        />
      ))}

      {customFields.map(({ key, field, config }) => (
        <CanvasCard
          key={String(key)}
          title={getFieldLabel(String(key))}
          field={field}
          onEdit={() => handleEditField(String(key))}
          onQuickEdit={(instruction) => handleQuickEdit(key, instruction)}
          onAcceptEdit={(value) => handleAcceptEdit(key, value)}
          onProvideContext={(context) => handleProvideContext(key, context)}
          renderValue={(value) => renderFieldValueWithStyle(value, ((config as { displayStyle?: DisplayStyle })?.displayStyle) || "auto")}
          className="md:col-span-2 xl:col-span-3"
        />
      ))}
    </div>
  );
}
