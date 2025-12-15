"use client";

import * as React from "react";
import { Loader2, Sparkles, PenLine, RefreshCw, ArrowLeft } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCanvasStore,
  type Story,
  type FeatureSuggestion,
} from "@/stores/canvas-store";
import type { BusinessCanvas } from "@/lib/validators/canvas-schema";
import { SuggestionCard } from "./SuggestionCard";

interface AddFeatureContentProps {
  canvas: BusinessCanvas;
  epicId: string;
  onClose: () => void;
}

export function AddFeatureContent({ canvas, epicId, onClose }: AddFeatureContentProps) {
  const addStories = useCanvasStore((state) => state.addStories);
  const stories = useCanvasStore((state) => state.stories);

  // Use persisted feature suggestions from store
  const featureSuggestions = useCanvasStore((state) => state.featureSuggestions);
  const addFeatureSuggestions = useCanvasStore((state) => state.addFeatureSuggestions);
  const markFeatureSuggestionAdded = useCanvasStore((state) => state.markFeatureSuggestionAdded);
  const removeFeatureSuggestion = useCanvasStore((state) => state.removeFeatureSuggestion);

  // Get parent epic
  const parentEpic = stories.find((s) => s.id === epicId);

  // Tab state
  const [activeTab, setActiveTab] = React.useState<"suggestions" | "custom">("suggestions");

  // Local UI state only
  const [isLoadingSuggestions, setIsLoadingSuggestions] = React.useState(false);

  // Custom form state
  const [customTitle, setCustomTitle] = React.useState("");
  const [customDescription, setCustomDescription] = React.useState("");
  const [customPriority, setCustomPriority] = React.useState<"high" | "medium" | "low">("medium");
  const [customStoryPoints, setCustomStoryPoints] = React.useState<string>("");
  const [isCreating, setIsCreating] = React.useState(false);

  // Get suggestions for this epic from the persisted store
  const suggestionsForEpic = featureSuggestions.filter((s) => s.epicId === epicId);

  // Load suggestions on mount ONLY if not already persisted for this epic
  React.useEffect(() => {
    if (suggestionsForEpic.length === 0) {
      generateFeatureSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateFeatureSuggestions = async () => {
    // Don't regenerate if we already have suggestions
    if (suggestionsForEpic.length > 0) return;

    setIsLoadingSuggestions(true);
    try {
      const allEpics = stories.filter((s) => s.type === "epic");

      const response = await fetch("/api/canvas/generate-features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId: canvas.id,
          epics: allEpics,
          selectedEpicIds: [epicId],
          persist: false,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate features");

      const { features } = await response.json();

      // Convert to FeatureSuggestion format and persist
      const suggestions: FeatureSuggestion[] = (features || []).map((f: Story) => ({
        id: f.id || `feature-suggestion-${nanoid(12)}`,
        title: f.title,
        description: f.description,
        priority: f.priority,
        storyPoints: f.storyPoints,
        epicId,
      }));

      addFeatureSuggestions(suggestions);
    } catch (error) {
      console.error("Error generating features:", error);
      toast.error("Failed to generate feature suggestions");
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleAddSuggestion = (suggestion: FeatureSuggestion) => {
    const newFeatureId = `feature-${nanoid(12)}`;
    const newFeature: Story = {
      id: newFeatureId,
      type: "feature",
      title: suggestion.title,
      description: suggestion.description,
      priority: suggestion.priority || "medium",
      epic: epicId,
      parentOKR: parentEpic?.parentOKR,
      storyPoints: suggestion.storyPoints,
    };

    addStories([newFeature]);
    // Mark suggestion as added (instead of removing it)
    markFeatureSuggestionAdded(suggestion.id, newFeatureId);
    toast.success(`Added feature: ${suggestion.title}`);
  };

  const handleDismissSuggestion = (id: string) => {
    removeFeatureSuggestion(id);
  };

  const handleCreateCustom = async () => {
    if (!customTitle.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setIsCreating(true);
    try {
      const newFeature: Story = {
        id: `feature-${nanoid(12)}`,
        type: "feature",
        title: customTitle.trim(),
        description: customDescription.trim(),
        priority: customPriority,
        epic: epicId,
        parentOKR: parentEpic?.parentOKR,
        storyPoints: customStoryPoints ? parseInt(customStoryPoints, 10) : undefined,
      };

      addStories([newFeature]);
      toast.success(`Created feature: ${newFeature.title}`);
      onClose();
    } catch (error) {
      console.error("Error creating feature:", error);
      toast.error("Failed to create feature");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground pb-2 border-b">
        <ArrowLeft className="h-4 w-4" />
        <span className="truncate">
          Epic: <span className="text-foreground">{parentEpic?.title || "Unknown"}</span>
        </span>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "suggestions" | "custom")}>
        <TabsList className="w-full">
          <TabsTrigger value="suggestions" className="flex-1">
            <Sparkles className="h-4 w-4 mr-2" />
            AI Suggestions
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex-1">
            <PenLine className="h-4 w-4 mr-2" />
            Create Custom
          </TabsTrigger>
        </TabsList>

        {/* AI Suggestions Tab */}
        <TabsContent value="suggestions" className="mt-4 space-y-4">
          {isLoadingSuggestions ? (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : suggestionsForEpic.length > 0 ? (
            <div className="space-y-3">
              {suggestionsForEpic.map((feature) => (
                <SuggestionCard
                  key={feature.id}
                  suggestion={{
                    id: feature.id,
                    type: "feature",
                    title: feature.title,
                    description: feature.description,
                    priority: feature.priority,
                    storyPoints: feature.storyPoints,
                  }}
                  onAdd={() => handleAddSuggestion(feature)}
                  onDismiss={feature.addedToCanvas ? undefined : handleDismissSuggestion}
                  isAddedToCanvas={feature.addedToCanvas}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No feature suggestions available.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={generateFeatureSuggestions}
                disabled={isLoadingSuggestions}
              >
                {isLoadingSuggestions ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Generate Suggestions
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Custom Creation Tab */}
        <TabsContent value="custom" className="mt-4 space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feature-title">Title *</Label>
              <Input
                id="feature-title"
                placeholder="Enter feature title..."
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="feature-description">Description</Label>
              <Textarea
                id="feature-description"
                placeholder="Describe this feature..."
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="feature-priority">Priority</Label>
                <Select value={customPriority} onValueChange={(v) => setCustomPriority(v as "high" | "medium" | "low")}>
                  <SelectTrigger id="feature-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feature-points">Story Points</Label>
                <Input
                  id="feature-points"
                  type="number"
                  placeholder="e.g., 8"
                  value={customStoryPoints}
                  onChange={(e) => setCustomStoryPoints(e.target.value)}
                />
              </div>
            </div>

            <Button
              onClick={handleCreateCustom}
              disabled={isCreating || !customTitle.trim()}
              className="w-full"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Create Feature
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
