"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, X, Save } from "lucide-react";
import type { Story } from "@/stores/canvas-store";
import { toast } from "sonner";

interface StoryViewEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  story: Story | null;
  onSave: (updatedStory: Story) => Promise<void>;
  mode?: "view" | "edit";
}

export function StoryViewEditModal({
  open,
  onOpenChange,
  story,
  onSave,
  mode: initialMode = "view",
}: StoryViewEditModalProps) {
  const [mode, setMode] = React.useState<"view" | "edit">(initialMode);
  const [isSaving, setIsSaving] = React.useState(false);

  // Form state
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState<"high" | "medium" | "low">("medium");
  const [storyPoints, setStoryPoints] = React.useState<number | undefined>(undefined);
  const [acceptanceCriteria, setAcceptanceCriteria] = React.useState<string[]>([]);
  const [newCriterion, setNewCriterion] = React.useState("");

  // Initialize form when story changes
  React.useEffect(() => {
    if (story) {
      setTitle(story.title || "");
      setDescription(story.description || "");
      setPriority(story.priority || "medium");
      setStoryPoints(story.storyPoints);
      setAcceptanceCriteria(story.acceptanceCriteria || []);
      setMode(initialMode);
    }
  }, [story, initialMode]);

  // Reset mode when modal closes
  React.useEffect(() => {
    if (!open) {
      setMode("view");
    }
  }, [open]);

  if (!story) return null;

  const typeLabel = story.type === "epic"
    ? "Epic"
    : story.type === "feature"
    ? "Feature"
    : story.type === "user-story"
    ? "User Story"
    : "Dev Story";

  const typeColor = story.type === "epic"
    ? "bg-purple-100 text-purple-800 border-purple-200"
    : story.type === "feature"
    ? "bg-blue-100 text-blue-800 border-blue-200"
    : story.type === "user-story"
    ? "bg-green-100 text-green-800 border-green-200"
    : "bg-orange-100 text-orange-800 border-orange-200";

  const handleAddCriterion = () => {
    if (newCriterion.trim()) {
      setAcceptanceCriteria([...acceptanceCriteria, newCriterion.trim()]);
      setNewCriterion("");
    }
  };

  const handleRemoveCriterion = (index: number) => {
    setAcceptanceCriteria(acceptanceCriteria.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    setIsSaving(true);
    try {
      const updatedStory: Story = {
        ...story,
        title: title.trim(),
        description: description.trim(),
        priority,
        storyPoints,
        acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : undefined,
      };

      await onSave(updatedStory);
      toast.success(`${typeLabel} updated successfully`);
      setMode("view");
    } catch (error) {
      console.error("Error saving story:", error);
      toast.error(`Failed to update ${typeLabel.toLowerCase()}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle>{mode === "view" ? "View" : "Edit"} {typeLabel}</DialogTitle>
              <Badge className={typeColor}>{typeLabel.toUpperCase()}</Badge>
            </div>
            {mode === "view" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMode("edit")}
              >
                Edit
              </Button>
            )}
          </div>
          <DialogDescription>
            {mode === "view"
              ? `Viewing details for this ${typeLabel.toLowerCase()}`
              : `Make changes to this ${typeLabel.toLowerCase()}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="story-title">Title *</Label>
            {mode === "view" ? (
              <p className="text-sm font-medium leading-relaxed">{story.title}</p>
            ) : (
              <Input
                id="story-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`Enter ${typeLabel.toLowerCase()} title`}
                required
              />
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="story-description">Description</Label>
            {mode === "view" ? (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {story.description || "No description provided"}
              </p>
            ) : (
              <Textarea
                id="story-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`Describe the ${typeLabel.toLowerCase()} in detail...`}
                rows={6}
                className="resize-none"
              />
            )}
          </div>

          {/* Priority and Story Points Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="story-priority">Priority</Label>
              {mode === "view" ? (
                <Badge
                  variant={
                    story.priority === "high"
                      ? "destructive"
                      : story.priority === "medium"
                      ? "default"
                      : "secondary"
                  }
                  className="capitalize"
                >
                  {story.priority || "medium"}
                </Badge>
              ) : (
                <Select value={priority} onValueChange={(v: "high" | "medium" | "low") => setPriority(v)}>
                  <SelectTrigger id="story-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {story.type !== "epic" && (
              <div className="space-y-2">
                <Label htmlFor="story-points">Story Points</Label>
                {mode === "view" ? (
                  <p className="text-sm font-medium">
                    {story.storyPoints || "Not estimated"}
                  </p>
                ) : (
                  <Input
                    id="story-points"
                    type="number"
                    min="0"
                    max="100"
                    value={storyPoints || ""}
                    onChange={(e) => setStoryPoints(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="e.g., 5"
                  />
                )}
              </div>
            )}
          </div>

          {/* Acceptance Criteria */}
          {story.type !== "epic" && (
            <div className="space-y-2">
              <Label>Acceptance Criteria</Label>
              {mode === "view" ? (
                story.acceptanceCriteria && story.acceptanceCriteria.length > 0 ? (
                  <ul className="space-y-2">
                    {story.acceptanceCriteria.map((criterion, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span className="text-primary mt-0.5">•</span>
                        <span className="flex-1">{criterion}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No acceptance criteria defined
                  </p>
                )
              ) : (
                <div className="space-y-3">
                  {acceptanceCriteria.map((criterion, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="text-primary mt-2.5">•</span>
                      <div className="flex-1 flex items-start gap-2">
                        <p className="text-sm flex-1 py-2">{criterion}</p>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRemoveCriterion(index)}
                          className="h-8 w-8"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      value={newCriterion}
                      onChange={(e) => setNewCriterion(e.target.value)}
                      placeholder="Add a new acceptance criterion..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCriterion();
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleAddCriterion}
                      disabled={!newCriterion.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {mode === "edit" ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  // Reset to original values
                  setTitle(story.title);
                  setDescription(story.description);
                  setPriority(story.priority || "medium");
                  setStoryPoints(story.storyPoints);
                  setAcceptanceCriteria(story.acceptanceCriteria || []);
                  setMode("view");
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
