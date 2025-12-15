"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Check, Eye, Target, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/stores/canvas-store";
import { StoryViewEditModal } from "./story-view-edit-modal";
import type { Story } from "@/stores/canvas-store";
import { toast } from "sonner";

interface CreateStoriesModalColumnarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canvasId: string;
  okrs: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    dueDate?: string;
  }>;
  onGenerateEpics: () => Promise<void>;
  onGenerateFeatures: () => Promise<void>;
  onGenerateUserStories: () => Promise<void>;
}

export function CreateStoriesModalColumnar({
  open,
  onOpenChange,
  canvasId: _canvasId,
  okrs,
  onGenerateEpics,
  onGenerateFeatures,
  onGenerateUserStories,
}: CreateStoriesModalColumnarProps) {
  const stories = useCanvasStore((state) => state.stories);
  const isGeneratingEpics = useCanvasStore((state) => state.isGeneratingEpics);
  const isGeneratingFeatures = useCanvasStore((state) => state.isGeneratingFeatures);
  const isGeneratingStories = useCanvasStore((state) => state.isGeneratingStories);

  // Mode selection: OKRs or Business Requirements
  const [generationMode, setGenerationMode] = React.useState<"okrs" | "business-requirements">(
    Array.isArray(okrs) && okrs.length > 0 ? "okrs" : "business-requirements"
  );

  // Local state for Finder-style column navigation
  const [selectedOKRForEpics, setSelectedOKRForEpics] = React.useState<string | null>(null);
  const [selectedBusinessReqForEpics, setSelectedBusinessReqForEpics] = React.useState<string | null>(null);
  const [selectedEpicForFeatures, setSelectedEpicForFeatures] = React.useState<string | null>(null);
  const [selectedFeatureForStories, setSelectedFeatureForStories] = React.useState<string | null>(null);

  // Business Requirements state (generated from canvas)
  const [businessRequirements, setBusinessRequirements] = React.useState<Array<{
    id: string;
    title: string;
    description: string;
    category: string;
  }>>([]);
  const [isGeneratingBusinessReqs, setIsGeneratingBusinessReqs] = React.useState(false);

  // View/Edit modal state
  const [viewModalOpen, setViewModalOpen] = React.useState(false);
  const [selectedStory, setSelectedStory] = React.useState<Story | null>(null);
  const updateStory = useCanvasStore((state) => state.updateStory);

  // Categorize stories by type
  const allEpics = stories.filter((s) => s.type === "epic");
  const allFeatures = stories.filter((s) => s.type === "feature");
  const userStories = stories.filter((s) => s.type === "user-story");
  const devStories = stories.filter((s) => s.type === "dev-story");

  // Get epics for selected OKR or Business Requirement (Finder-style)
  const epicsForSelectedOKR = React.useMemo(() => {
    const selectedId = generationMode === "okrs" ? selectedOKRForEpics : selectedBusinessReqForEpics;
    return selectedId ? allEpics.filter((e) => e.parentOKR === selectedId) : [];
  }, [generationMode, selectedOKRForEpics, selectedBusinessReqForEpics, allEpics]);

  // Get features for selected epic (Finder-style)
  const featuresForSelectedEpic = selectedEpicForFeatures
    ? allFeatures.filter((f) => f.epic === selectedEpicForFeatures)
    : [];

  // Get features that already have stories generated
  const featuresWithStories = React.useMemo(() => {
    const featureIdsWithStories = new Set<string>();
    [...userStories, ...devStories].forEach((story) => {
      if (story.feature) {
        featureIdsWithStories.add(story.feature);
      }
    });
    return featureIdsWithStories;
  }, [userStories, devStories]);

  // Check if a feature is disabled (already has stories)
  const isFeatureDisabled = (featureId: string) => {
    return featuresWithStories.has(featureId);
  };

  // Generate business requirements from canvas data
  const handleGenerateBusinessRequirements = async () => {
    setIsGeneratingBusinessReqs(true);
    try {
      const response = await fetch("/api/canvas/generate-business-requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasId: _canvasId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to generate business requirements");
      }

      const data = await response.json();
      setBusinessRequirements(data.requirements || []);
      toast.success("Business requirements generated!");
    } catch (error) {
      console.error("Error generating business requirements:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate business requirements";
      toast.error(errorMessage);
    } finally {
      setIsGeneratingBusinessReqs(false);
    }
  };

  // Handle generating epics for selected OKR
  const handleGenerateEpicsForOKR = async () => {
    if (!selectedOKRForEpics) return;

    // Check if we already have epics for this OKR to prevent duplicates
    const existingEpicsForOKR = allEpics.filter(epic => epic.parentOKR === selectedOKRForEpics);
    if (existingEpicsForOKR.length > 0) {
      toast.error(`Epics already generated for this OKR. ${existingEpicsForOKR.length} epic(s) exist.`);
      return;
    }

    // Ensure this OKR is selected (add it if not already present)
    const { selectedOKRs: currentSelectedOKRs, setSelectedOKRs } = useCanvasStore.getState();
    if (!currentSelectedOKRs.includes(selectedOKRForEpics)) {
      setSelectedOKRs([...currentSelectedOKRs, selectedOKRForEpics]);
    }

    await onGenerateEpics();
  };

  // Handle generating epics for selected Business Requirement
  const handleGenerateEpicsForBusinessReq = async () => {
    if (!selectedBusinessReqForEpics) return;

    // Generate epics from the selected business requirement
    const selectedReq = businessRequirements.find(r => r.id === selectedBusinessReqForEpics);
    if (!selectedReq) return;

    // Check if we already have epics for this requirement to prevent duplicates
    const existingEpicsForReq = allEpics.filter(epic => epic.parentOKR === selectedReq.id);
    if (existingEpicsForReq.length > 0) {
      toast.error(`Epics already generated for this requirement. ${existingEpicsForReq.length} epic(s) exist.`);
      return;
    }

    // Pass the business requirement to the epic generation
    const { setGeneratingEpics, addStories } = useCanvasStore.getState();
    setGeneratingEpics(true);

    try {
      const response = await fetch("/api/canvas/generate-epics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId: _canvasId,
          businessRequirement: selectedReq,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to generate epics");
      }

      const { epics: generatedEpics } = await response.json();
      addStories(generatedEpics);
      toast.success(`Generated ${generatedEpics.length} epics from: ${selectedReq.title}`);
    } catch (error) {
      console.error("Error generating epics:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate epics";
      toast.error(errorMessage);
    } finally {
      setGeneratingEpics(false);
    }
  };

  // Handle generating features for selected epic
  const handleGenerateFeaturesForEpic = async () => {
    if (!selectedEpicForFeatures) return;

    // Ensure this epic is selected (add it if not already present)
    const { selectedEpics: currentSelectedEpics, setSelectedEpics } = useCanvasStore.getState();
    if (!currentSelectedEpics.includes(selectedEpicForFeatures)) {
      setSelectedEpics([...currentSelectedEpics, selectedEpicForFeatures]);
    }

    await onGenerateFeatures();
  };

  // Handle generating stories for selected feature
  const handleGenerateStoriesForFeature = async () => {
    if (!selectedFeatureForStories) return;

    // Ensure this feature is selected (add it if not already present)
    const { selectedFeatures: currentSelectedFeatures, setSelectedFeatures } = useCanvasStore.getState();
    if (!currentSelectedFeatures.includes(selectedFeatureForStories)) {
      setSelectedFeatures([...currentSelectedFeatures, selectedFeatureForStories]);
    }

    await onGenerateUserStories();

    // Auto-close modal after generating stories
    setTimeout(() => {
      onOpenChange(false);
    }, 500);
  };

  // Handle viewing a story
  const handleViewStory = (story: Story, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedStory(story);
    setViewModalOpen(true);
  };

  // Handle saving story updates
  const handleSaveStory = async (updatedStory: Story) => {
    updateStory(updatedStory.id, updatedStory);
    setViewModalOpen(false);
    toast.success("Story updated successfully");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Stories</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-4 gap-3 h-full">
            {/* Column 1: OKRs or Business Requirements */}
            <div className="border rounded-lg overflow-hidden flex flex-col">
              <Tabs value={generationMode} onValueChange={(v) => setGenerationMode(v as "okrs" | "business-requirements")} className="h-full flex flex-col">
                <div className="p-3 bg-muted/50 border-b">
                  <TabsList className="grid w-full grid-cols-2 mb-2">
                    <TabsTrigger value="business-requirements" className="text-xs">
                      <Lightbulb className="h-3 w-3 mr-1" />
                      Requirements
                    </TabsTrigger>
                    <TabsTrigger value="okrs" className="text-xs" disabled={!Array.isArray(okrs) || okrs.length === 0}>
                      <Target className="h-3 w-3 mr-1" />
                      OKRs
                    </TabsTrigger>
                  </TabsList>
                  <p className="text-xs text-muted-foreground">
                    {generationMode === "okrs" ? "Select OKR to generate epics" : "Generate ideas from canvas"}
                  </p>
                </div>

                <TabsContent value="okrs" className="flex-1 overflow-y-auto p-2 space-y-2 m-0">
                  {okrs
                    .filter((okr) => okr.type === "objective")
                    .map((okr) => (
                      <div
                        key={okr.id}
                        className={cn(
                          "border rounded p-2 cursor-pointer transition-all hover:shadow-sm",
                          selectedOKRForEpics === okr.id
                            ? "bg-primary/10 border-primary ring-2 ring-primary/20"
                            : "bg-card"
                        )}
                        onClick={() => {
                          setSelectedOKRForEpics(okr.id);
                          setSelectedBusinessReqForEpics(null);
                          setSelectedEpicForFeatures(null);
                          setSelectedFeatureForStories(null);
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs line-clamp-2">{okr.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {okr.description}
                            </p>
                          </div>
                          {selectedOKRForEpics === okr.id && (
                            <Check className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                </TabsContent>

                <TabsContent value="business-requirements" className="flex-1 overflow-y-auto p-2 space-y-2 m-0">
                  {businessRequirements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-2 py-4">
                      <Lightbulb className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-3">
                        Generate business requirements from your canvas data
                      </p>
                      <Button
                        onClick={handleGenerateBusinessRequirements}
                        disabled={isGeneratingBusinessReqs}
                        size="sm"
                        className="w-full"
                      >
                        {isGeneratingBusinessReqs ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Generating...
                          </>
                        ) : (
                          <>Generate Ideas</>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <>
                      {businessRequirements.map((req) => (
                        <div
                          key={req.id}
                          className={cn(
                            "border rounded p-2 cursor-pointer transition-all hover:shadow-sm",
                            selectedBusinessReqForEpics === req.id
                              ? "bg-primary/10 border-primary ring-2 ring-primary/20"
                              : "bg-card"
                          )}
                          onClick={() => {
                            setSelectedBusinessReqForEpics(req.id);
                            setSelectedOKRForEpics(null);
                            setSelectedEpicForFeatures(null);
                            setSelectedFeatureForStories(null);
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <Badge variant="outline" className="text-xs mb-1">
                                {req.category}
                              </Badge>
                              <p className="font-medium text-xs line-clamp-2">{req.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                {req.description}
                              </p>
                            </div>
                            {selectedBusinessReqForEpics === req.id && (
                              <Check className="h-4 w-4 text-primary shrink-0" />
                            )}
                          </div>
                        </div>
                      ))}
                      <Button
                        onClick={handleGenerateBusinessRequirements}
                        disabled={isGeneratingBusinessReqs}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        {isGeneratingBusinessReqs ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Regenerating...
                          </>
                        ) : (
                          <>Regenerate Ideas</>
                        )}
                      </Button>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Column 2: Epics */}
            <div className="border rounded-lg overflow-hidden flex flex-col">
              <div className="p-3 bg-muted/50 border-b">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">Epics</h3>
                  <Badge variant="secondary" className="text-xs">
                    {epicsForSelectedOKR.length}
                  </Badge>
                </div>
                {epicsForSelectedOKR.length > 0 ? (
                  <p className="text-xs text-muted-foreground mb-2">
                    {epicsForSelectedOKR.length} epic{epicsForSelectedOKR.length !== 1 ? 's' : ''} generated
                  </p>
                ) : (
                  <Button
                    onClick={generationMode === "okrs" ? handleGenerateEpicsForOKR : handleGenerateEpicsForBusinessReq}
                    disabled={
                      isGeneratingEpics ||
                      (generationMode === "okrs" ? !selectedOKRForEpics : !selectedBusinessReqForEpics)
                    }
                    size="sm"
                    className="w-full"
                  >
                    {isGeneratingEpics ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Generating...
                      </>
                    ) : (
                      <>Generate Epics</>
                    )}
                  </Button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {!selectedOKRForEpics && !selectedBusinessReqForEpics ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground text-center px-2">
                      {generationMode === "okrs"
                        ? "Select an OKR to view epics"
                        : "Select a business requirement to view epics"}
                    </p>
                  </div>
                ) : epicsForSelectedOKR.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground text-center px-2">
                      {generationMode === "okrs"
                        ? "No epics yet. Generate epics for this OKR."
                        : "No epics yet. Generate epics for this requirement."}
                    </p>
                  </div>
                ) : (
                  epicsForSelectedOKR.map((epic, idx) => (
                    <div
                      key={epic.id}
                      className={cn(
                        "border rounded p-2 cursor-pointer transition-all hover:shadow-sm group",
                        selectedEpicForFeatures === epic.id
                          ? "bg-primary/10 border-primary ring-2 ring-primary/20"
                          : "bg-card"
                      )}
                      onClick={() => {
                        setSelectedEpicForFeatures(epic.id);
                        setSelectedFeatureForStories(null);
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="text-xs shrink-0">
                          EPIC-{idx + 1}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs line-clamp-2 mb-1">{epic.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {epic.description}
                          </p>
                          <Badge
                            variant={
                              epic.priority === "high"
                                ? "destructive"
                                : epic.priority === "medium"
                                ? "default"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {epic.priority}
                          </Badge>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => handleViewStory(epic, e)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {selectedEpicForFeatures === epic.id && (
                            <Check className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Column 3: Features */}
            <div className="border rounded-lg overflow-hidden flex flex-col">
              <div className="p-3 bg-muted/50 border-b">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">Features</h3>
                  <Badge variant="secondary" className="text-xs">
                    {featuresForSelectedEpic.length} features
                  </Badge>
                </div>
                <Button
                  onClick={handleGenerateFeaturesForEpic}
                  disabled={isGeneratingFeatures || !selectedEpicForFeatures}
                  size="sm"
                  className="w-full"
                >
                  {isGeneratingFeatures ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>Generate Features</>
                  )}
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {!selectedEpicForFeatures ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground text-center px-2">
                      Select an epic to view features
                    </p>
                  </div>
                ) : featuresForSelectedEpic.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground text-center px-2">
                      No features yet. Generate features for this epic.
                    </p>
                  </div>
                ) : (
                  featuresForSelectedEpic.map((feature, idx) => (
                    <div
                      key={`${feature.id}-${idx}`}
                      className={cn(
                        "border rounded p-2 cursor-pointer transition-all hover:shadow-sm group",
                        selectedFeatureForStories === feature.id
                          ? "bg-primary/10 border-primary ring-2 ring-primary/20"
                          : "bg-card"
                      )}
                      onClick={() => {
                        setSelectedFeatureForStories(feature.id);
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="text-xs shrink-0">
                          FEAT-{idx + 1}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs line-clamp-2 mb-1">{feature.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {feature.description}
                          </p>
                          <div className="flex items-center gap-1 flex-wrap">
                            {feature.storyPoints && (
                              <Badge variant="outline" className="text-xs">
                                {feature.storyPoints} pts
                              </Badge>
                            )}
                            <Badge
                              variant={
                                feature.priority === "high"
                                  ? "destructive"
                                  : feature.priority === "medium"
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-xs"
                            >
                              {feature.priority}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => handleViewStory(feature, e)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {selectedFeatureForStories === feature.id && (
                            <Check className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Column 4: Stories */}
            <div className="border rounded-lg overflow-hidden flex flex-col">
              <div className="p-3 bg-muted/50 border-b">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">Stories</h3>
                  <Badge variant="secondary" className="text-xs">
                    {userStories.length + devStories.length} total
                  </Badge>
                </div>
                <Button
                  onClick={handleGenerateStoriesForFeature}
                  disabled={
                    isGeneratingStories ||
                    !selectedFeatureForStories ||
                    isFeatureDisabled(selectedFeatureForStories)
                  }
                  size="sm"
                  className="w-full"
                >
                  {isGeneratingStories ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Generating...
                    </>
                  ) : isFeatureDisabled(selectedFeatureForStories || "") ? (
                    <>Already Generated</>
                  ) : (
                    <>Generate Stories</>
                  )}
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {!selectedFeatureForStories ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground text-center px-2">
                      Select a feature to view stories
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(() => {
                      const featureStories = [...userStories, ...devStories].filter(
                        (s) => s.feature === selectedFeatureForStories
                      );

                      if (featureStories.length === 0) {
                        return (
                          <div className="flex items-center justify-center h-full py-8">
                            <p className="text-sm text-muted-foreground text-center px-2">
                              {isFeatureDisabled(selectedFeatureForStories)
                                ? "Stories already generated for this feature"
                                : "No stories yet. Generate stories for this feature."}
                            </p>
                          </div>
                        );
                      }

                      return featureStories.map((story, idx) => (
                        <div key={`${story.id}-${idx}`} className="border rounded p-2 bg-card group">
                          <div className="flex items-start gap-2 mb-1">
                            <Badge
                              variant={story.type === "user-story" ? "default" : "secondary"}
                              className="text-xs shrink-0"
                            >
                              {story.type === "user-story" ? "USER" : "DEV"}
                            </Badge>
                            <p className="font-medium text-xs flex-1 line-clamp-2">
                              {story.title}
                            </p>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => handleViewStory(story, e)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {story.description}
                          </p>
                          {story.storyPoints && (
                            <Badge variant="outline" className="text-xs">
                              {story.storyPoints} pts
                            </Badge>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* View/Edit Modal */}
      <StoryViewEditModal
        open={viewModalOpen}
        onOpenChange={setViewModalOpen}
        story={selectedStory}
        onSave={handleSaveStory}
        mode="view"
      />
    </Dialog>
  );
}
