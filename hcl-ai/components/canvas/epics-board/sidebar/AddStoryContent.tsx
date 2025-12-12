"use client";

import * as React from "react";
import { Loader2, Sparkles, PenLine, RefreshCw, ArrowLeft, User, Code } from "lucide-react";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  useCanvasStore,
  type Story,
  type StorySuggestion,
} from "@/stores/canvas-store";
import type { BusinessCanvas } from "@/lib/validators/canvas-schema";
import { SuggestionCard } from "./SuggestionCard";

interface AddStoryContentProps {
  canvas: BusinessCanvas;
  featureId: string;
  onClose: () => void;
}

export function AddStoryContent({ canvas, featureId, onClose }: AddStoryContentProps) {
  const addStories = useCanvasStore((state) => state.addStories);
  const stories = useCanvasStore((state) => state.stories);

  // Use persisted story suggestions from store
  const storySuggestions = useCanvasStore((state) => state.storySuggestions);
  const addStorySuggestions = useCanvasStore((state) => state.addStorySuggestions);
  const markStorySuggestionAdded = useCanvasStore((state) => state.markStorySuggestionAdded);
  const removeStorySuggestion = useCanvasStore((state) => state.removeStorySuggestion);

  // Get parent feature and epic
  const parentFeature = stories.find((s) => s.id === featureId);
  const parentEpic = parentFeature?.epic
    ? stories.find((s) => s.id === parentFeature.epic)
    : null;

  // Tab state
  const [activeTab, setActiveTab] = React.useState<"suggestions" | "custom">("suggestions");

  // Story type toggle (for both tabs)
  const [storyType, setStoryType] = React.useState<"user-story" | "dev-story">("user-story");

  // Local UI state only
  const [isLoadingSuggestions, setIsLoadingSuggestions] = React.useState(false);

  // Custom form state
  const [customTitle, setCustomTitle] = React.useState("");
  const [customDescription, setCustomDescription] = React.useState("");
  const [customPriority, setCustomPriority] = React.useState<"high" | "medium" | "low">("medium");
  const [customStoryPoints, setCustomStoryPoints] = React.useState<string>("");
  const [customAcceptanceCriteria, setCustomAcceptanceCriteria] = React.useState<string>("");
  const [isCreating, setIsCreating] = React.useState(false);

  // Get suggestions for this feature from the persisted store
  const suggestionsForFeature = storySuggestions.filter((s) => s.featureId === featureId);
  const userStorySuggestions = suggestionsForFeature.filter((s) => s.type === "user-story");
  const devStorySuggestions = suggestionsForFeature.filter((s) => s.type === "dev-story");
  const currentSuggestions = storyType === "user-story" ? userStorySuggestions : devStorySuggestions;

  // Load suggestions on mount ONLY if not already persisted for this feature
  React.useEffect(() => {
    if (suggestionsForFeature.length === 0) {
      generateStorySuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateStorySuggestions = async () => {
    // Don't regenerate if we already have suggestions
    if (suggestionsForFeature.length > 0) return;

    setIsLoadingSuggestions(true);
    try {
      const allFeatures = stories.filter((s) => s.type === "feature");

      const response = await fetch("/api/canvas/generate-user-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId: canvas.id,
          features: allFeatures,
          selectedFeatureIds: [featureId],
          persist: false,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate stories");

      const { stories: generatedStories } = await response.json();

      // Convert to StorySuggestion format and persist
      const suggestions: StorySuggestion[] = (generatedStories || []).map((s: Story) => ({
        id: s.id || `story-suggestion-${nanoid(12)}`,
        type: s.type as "user-story" | "dev-story",
        title: s.title,
        description: s.description,
        priority: s.priority,
        storyPoints: s.storyPoints,
        acceptanceCriteria: s.acceptanceCriteria,
        featureId,
      }));

      addStorySuggestions(suggestions);
    } catch (error) {
      console.error("Error generating stories:", error);
      toast.error("Failed to generate story suggestions");
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleAddSuggestion = (suggestion: StorySuggestion) => {
    const newStoryId = `${suggestion.type}-${nanoid(12)}`;
    const newStory: Story = {
      id: newStoryId,
      type: suggestion.type,
      title: suggestion.title,
      description: suggestion.description,
      priority: suggestion.priority || "medium",
      feature: featureId,
      epic: parentFeature?.epic,
      parentOKR: parentFeature?.parentOKR,
      storyPoints: suggestion.storyPoints,
      acceptanceCriteria: suggestion.acceptanceCriteria,
    };

    addStories([newStory]);
    // Mark suggestion as added (instead of removing it)
    markStorySuggestionAdded(suggestion.id, newStoryId);
    toast.success(`Added ${storyType === "user-story" ? "user story" : "dev story"}: ${suggestion.title}`);
  };

  const handleDismissSuggestion = (id: string) => {
    removeStorySuggestion(id);
  };

  const handleCreateCustom = async () => {
    if (!customTitle.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setIsCreating(true);
    try {
      // Parse acceptance criteria from newline-separated text
      const acceptanceCriteria = customAcceptanceCriteria
        .split("\n")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      const newStory: Story = {
        id: `${storyType}-${nanoid(12)}`,
        type: storyType,
        title: customTitle.trim(),
        description: customDescription.trim(),
        priority: customPriority,
        feature: featureId,
        epic: parentFeature?.epic,
        parentOKR: parentFeature?.parentOKR,
        storyPoints: customStoryPoints ? parseInt(customStoryPoints, 10) : undefined,
        acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : undefined,
      };

      addStories([newStory]);
      toast.success(`Created ${storyType === "user-story" ? "user story" : "dev story"}: ${newStory.title}`);
      onClose();
    } catch (error) {
      console.error("Error creating story:", error);
      toast.error("Failed to create story");
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
          {parentEpic?.title && (
            <>
              <span className="text-foreground">{parentEpic.title}</span>
              <span className="mx-1">/</span>
            </>
          )}
          <span className="text-foreground">{parentFeature?.title || "Unknown"}</span>
        </span>
      </div>

      {/* Story Type Toggle */}
      <div className="space-y-2">
        <Label>Story Type</Label>
        <ToggleGroup
          type="single"
          value={storyType}
          onValueChange={(v) => v && setStoryType(v as "user-story" | "dev-story")}
          className="justify-start"
        >
          <ToggleGroupItem value="user-story" className="gap-2">
            <User className="h-4 w-4" />
            User Story
          </ToggleGroupItem>
          <ToggleGroupItem value="dev-story" className="gap-2">
            <Code className="h-4 w-4" />
            Dev Story
          </ToggleGroupItem>
        </ToggleGroup>
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
          ) : currentSuggestions.length > 0 ? (
            <div className="space-y-3">
              {currentSuggestions.map((story) => (
                <SuggestionCard
                  key={story.id}
                  suggestion={{
                    id: story.id,
                    type: story.type,
                    title: story.title,
                    description: story.description,
                    priority: story.priority,
                    storyPoints: story.storyPoints,
                    acceptanceCriteria: story.acceptanceCriteria,
                  }}
                  onAdd={() => handleAddSuggestion(story)}
                  onDismiss={story.addedToCanvas ? undefined : handleDismissSuggestion}
                  isAddedToCanvas={story.addedToCanvas}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No {storyType === "user-story" ? "user story" : "dev story"} suggestions available.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={generateStorySuggestions}
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
              <Label htmlFor="story-title">Title *</Label>
              <Input
                id="story-title"
                placeholder={
                  storyType === "user-story"
                    ? "As a user, I want to..."
                    : "Implement..."
                }
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="story-description">Description</Label>
              <Textarea
                id="story-description"
                placeholder="Describe this story..."
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="story-acceptance">
                {storyType === "user-story" ? "Acceptance Criteria" : "Technical Requirements"}
              </Label>
              <Textarea
                id="story-acceptance"
                placeholder="Enter each criterion on a new line..."
                value={customAcceptanceCriteria}
                onChange={(e) => setCustomAcceptanceCriteria(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                One criterion per line
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="story-priority">Priority</Label>
                <Select value={customPriority} onValueChange={(v) => setCustomPriority(v as "high" | "medium" | "low")}>
                  <SelectTrigger id="story-priority">
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
                <Label htmlFor="story-points">Story Points</Label>
                <Input
                  id="story-points"
                  type="number"
                  placeholder="e.g., 3"
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
              Create {storyType === "user-story" ? "User Story" : "Dev Story"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
