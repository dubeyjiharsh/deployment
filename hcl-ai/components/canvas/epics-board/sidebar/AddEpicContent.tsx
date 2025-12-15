"use client";

import * as React from "react";
import { Loader2, ChevronDown, ChevronRight, Plus, Sparkles, Check } from "lucide-react";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCanvasStore,
  type Story,
  type EpicSuggestion,
} from "@/stores/canvas-store";
import type { BusinessCanvas } from "@/lib/validators/canvas-schema";

interface AddEpicContentProps {
  canvas: BusinessCanvas;
  onClose: () => void;
}

interface OKRItem {
  id: string;
  type: string;
  title: string;
  description: string;
}

export function AddEpicContent({ canvas, onClose }: AddEpicContentProps) {
  const addStories = useCanvasStore((state) => state.addStories);
  const stories = useCanvasStore((state) => state.stories);
  const existingEpics = stories.filter((s) => s.type === "epic");

  // Use persisted business requirements and epic suggestions from store
  const businessRequirements = useCanvasStore((state) => state.businessRequirements);
  const setBusinessRequirements = useCanvasStore((state) => state.setBusinessRequirements);
  const epicSuggestions = useCanvasStore((state) => state.epicSuggestions);
  const addEpicSuggestions = useCanvasStore((state) => state.addEpicSuggestions);
  const markEpicSuggestionAdded = useCanvasStore((state) => state.markEpicSuggestionAdded);

  // Tab state - Requirements or OKRs
  const [activeTab, setActiveTab] = React.useState<"requirements" | "okrs">("requirements");

  // Custom form visibility
  const [showCustomForm, setShowCustomForm] = React.useState(false);

  // Custom form state
  const [customTitle, setCustomTitle] = React.useState("");
  const [customDescription, setCustomDescription] = React.useState("");
  const [customPriority, setCustomPriority] = React.useState<"high" | "medium" | "low">("medium");
  const [isCreating, setIsCreating] = React.useState(false);

  // Local UI state only
  const [loadingSource, setLoadingSource] = React.useState<string | null>(null);
  const [expandedSources, setExpandedSources] = React.useState<Set<string>>(new Set());
  const [isLoadingRequirements, setIsLoadingRequirements] = React.useState(false);

  // Get OKRs from canvas
  const okrsValue = canvas.okrs?.value;
  const okrs = React.useMemo((): OKRItem[] => {
    return (Array.isArray(okrsValue) ? okrsValue : [])
      .filter(
        (item): item is { id?: string; type: string; title: string; description: string } =>
          typeof item === "object" &&
          item !== null &&
          "type" in item &&
          "title" in item &&
          "description" in item
      )
      .filter((item) => item.type === "objective")
      .map((item, index) => ({
        ...item,
        id: item.id || `okr-${index}`,
      }));
  }, [okrsValue]);

  // Load business requirements on mount ONLY if not already persisted
  React.useEffect(() => {
    if (businessRequirements.length === 0) {
      loadBusinessRequirements();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBusinessRequirements = async () => {
    // Don't regenerate if we already have requirements
    if (businessRequirements.length > 0) return;

    setIsLoadingRequirements(true);
    try {
      const response = await fetch("/api/canvas/generate-business-requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasId: canvas.id }),
      });

      if (!response.ok) throw new Error("Failed to generate business requirements");

      const data = await response.json();
      // Save to store (which will persist to database)
      setBusinessRequirements(data.requirements || []);
    } catch (error) {
      console.error("Error loading business requirements:", error);
      // Don't show toast - silently fail
    } finally {
      setIsLoadingRequirements(false);
    }
  };

  // Get epic suggestions for a specific source from the persisted store
  const getEpicsForSource = (sourceId: string) => {
    return epicSuggestions.filter((e) => e.sourceId === sourceId);
  };

  const toggleSource = (sourceId: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
        // Generate epics for this source ONLY if not already in the persisted store
        const existingSuggestions = getEpicsForSource(sourceId);
        if (existingSuggestions.length === 0 && loadingSource !== sourceId) {
          generateEpicsForSource(sourceId);
        }
      }
      return next;
    });
  };

  const generateEpicsForSource = async (sourceId: string) => {
    // Check if we already have suggestions for this source in the store
    const existingSuggestions = getEpicsForSource(sourceId);
    if (existingSuggestions.length > 0) {
      return; // Don't regenerate
    }

    // Check for existing epics for this source
    const existingForSource = existingEpics.filter((e) => e.parentOKR === sourceId);
    if (existingForSource.length >= 3) {
      toast.info("Max epics reached for this source");
      return;
    }

    setLoadingSource(sourceId);
    try {
      // Determine if it's an OKR or requirement
      const isOKR = okrs.some((o) => o.id === sourceId);
      const body: Record<string, unknown> = { canvasId: canvas.id, persist: false };

      if (isOKR) {
        body.selectedOKRIds = [sourceId];
      } else {
        const req = businessRequirements.find((r) => r.id === sourceId);
        if (req) body.businessRequirement = req;
      }

      const response = await fetch("/api/canvas/generate-epics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Failed to generate epics");

      const { epics } = await response.json();

      // Limit to 3 epics per source and add sourceId for persistence
      const limitedEpics: EpicSuggestion[] = (epics || []).slice(0, 3).map((epic: Omit<EpicSuggestion, "id" | "sourceId">) => ({
        ...epic,
        id: `suggested-epic-${nanoid(12)}`,
        sourceId, // Track which source this suggestion came from
      }));

      // Add to store (which will persist to database)
      addEpicSuggestions(limitedEpics);
    } catch (error) {
      console.error("Error generating epics:", error);
      toast.error("Failed to generate epics");
    } finally {
      setLoadingSource(null);
    }
  };

  const handleAddEpic = (sourceId: string, epic: EpicSuggestion) => {
    const newEpicId = `epic-${nanoid(12)}`;
    const newEpic: Story = {
      id: newEpicId,
      type: "epic",
      title: epic.title,
      description: epic.description,
      priority: epic.priority || "medium",
      parentOKR: sourceId,
    };

    addStories([newEpic]);

    // Mark suggestion as added (instead of removing it)
    markEpicSuggestionAdded(epic.id, newEpicId);

    toast.success(`Added epic: ${epic.title}`);
  };

  const handleCreateCustom = async () => {
    if (!customTitle.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setIsCreating(true);
    try {
      const newEpic: Story = {
        id: `epic-${nanoid(12)}`,
        type: "epic",
        title: customTitle.trim(),
        description: customDescription.trim(),
        priority: customPriority,
      };

      addStories([newEpic]);
      toast.success(`Created epic: ${newEpic.title}`);
      onClose();
    } catch (error) {
      console.error("Error creating epic:", error);
      toast.error("Failed to create epic");
    } finally {
      setIsCreating(false);
    }
  };

  const renderSourceItem = (
    source: { id: string; title: string; description: string },
    _type: "okr" | "requirement"
  ) => {
    const isExpanded = expandedSources.has(source.id);
    const epics = getEpicsForSource(source.id); // Use persisted suggestions from store
    const isLoading = loadingSource === source.id;
    const existingCount = existingEpics.filter((e) => e.parentOKR === source.id).length;

    return (
      <Collapsible
        key={source.id}
        open={isExpanded}
        onOpenChange={() => toggleSource(source.id)}
      >
        <div className="border rounded-lg overflow-hidden">
          <CollapsibleTrigger className="w-full p-4 flex items-start gap-3 hover:bg-muted/50 transition-colors text-left">
            <div className="mt-0.5">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{source.title}</span>
                {existingCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {existingCount} epic{existingCount !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {source.description}
              </p>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-4 pb-4 pt-2 space-y-2 border-t bg-muted/20">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : epics.length > 0 ? (
                epics.map((epic) => (
                  <div
                    key={epic.id}
                    className={`bg-background border rounded-md p-3 flex items-start justify-between gap-2 ${
                      epic.addedToCanvas ? "opacity-60 border-green-300 bg-green-50/50" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{epic.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {epic.description}
                      </p>
                    </div>
                    {epic.addedToCanvas ? (
                      <div className="flex items-center gap-1 text-green-600 text-xs font-medium shrink-0">
                        <Check className="h-4 w-4" />
                        Added
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAddEpic(source.id, epic)}
                        className="shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  <Sparkles className="h-5 w-5 mx-auto mb-2 opacity-50" />
                  <p>No epic suggestions yet</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => generateEpicsForSource(source.id)}
                    disabled={isLoading}
                  >
                    Generate suggestions
                  </Button>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "requirements" | "okrs")}
        className="flex-1 flex flex-col"
      >
        <TabsList className="w-full shrink-0">
          <TabsTrigger value="requirements" className="flex-1">
            Requirements
          </TabsTrigger>
          <TabsTrigger value="okrs" className="flex-1">
            OKRs
          </TabsTrigger>
        </TabsList>

        {/* Requirements Tab */}
        <TabsContent value="requirements" className="flex-1 mt-4 space-y-3 overflow-y-auto">
          {isLoadingRequirements ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : businessRequirements.length > 0 ? (
            businessRequirements.map((req) =>
              renderSourceItem(req, "requirement")
            )
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No business requirements found.</p>
              <Button
                variant="link"
                onClick={loadBusinessRequirements}
                disabled={isLoadingRequirements}
              >
                Generate from canvas
              </Button>
            </div>
          )}
        </TabsContent>

        {/* OKRs Tab */}
        <TabsContent value="okrs" className="flex-1 mt-4 space-y-3 overflow-y-auto">
          {okrs.length > 0 ? (
            okrs.map((okr) => renderSourceItem(okr, "okr"))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No OKRs found in your canvas.</p>
              <p className="text-sm mt-1">Add OKRs in the OKRs tab first.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Custom Section */}
      <div className="border-t pt-4 mt-4 shrink-0">
        {showCustomForm ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Create Custom Epic</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCustomForm(false)}
              >
                Cancel
              </Button>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="epic-title">Title *</Label>
                <Input
                  id="epic-title"
                  placeholder="Enter epic title..."
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="epic-description">Description</Label>
                <Textarea
                  id="epic-description"
                  placeholder="Describe this epic..."
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="epic-priority">Priority</Label>
                <Select
                  value={customPriority}
                  onValueChange={(v) => setCustomPriority(v as "high" | "medium" | "low")}
                >
                  <SelectTrigger id="epic-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleCreateCustom}
                disabled={isCreating || !customTitle.trim()}
                className="w-full"
              >
                {isCreating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create Epic
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => setShowCustomForm(true)}
          >
            Add Custom
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
