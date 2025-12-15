"use client";

import * as React from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useCanvasStore, type Story } from "@/stores/canvas-store";

interface EditItemContentProps {
  item: Story;
  onClose: () => void;
}

const typeLabels: Record<Story["type"], string> = {
  epic: "Epic",
  feature: "Feature",
  "user-story": "User Story",
  "dev-story": "Dev Story",
};

const typeBadgeColors: Record<Story["type"], string> = {
  epic: "bg-purple-500/10 text-purple-700 border-purple-200",
  feature: "bg-blue-500/10 text-blue-700 border-blue-200",
  "user-story": "bg-green-500/10 text-green-700 border-green-200",
  "dev-story": "bg-orange-500/10 text-orange-700 border-orange-200",
};

export function EditItemContent({ item, onClose }: EditItemContentProps) {
  const updateStory = useCanvasStore((state) => state.updateStory);
  const stories = useCanvasStore((state) => state.stories);
  const setStories = useCanvasStore((state) => state.setStories);

  // Restore suggestion functions
  const restoreEpicSuggestion = useCanvasStore((state) => state.restoreEpicSuggestion);
  const restoreFeatureSuggestion = useCanvasStore((state) => state.restoreFeatureSuggestion);
  const restoreStorySuggestion = useCanvasStore((state) => state.restoreStorySuggestion);

  // Form state
  const [title, setTitle] = React.useState(item.title);
  const [description, setDescription] = React.useState(item.description || "");
  const [priority, setPriority] = React.useState<"high" | "medium" | "low">(item.priority || "medium");
  const [storyPoints, setStoryPoints] = React.useState<string>(item.storyPoints?.toString() || "");
  const [acceptanceCriteria, setAcceptanceCriteria] = React.useState<string>(
    item.acceptanceCriteria?.join("\n") || ""
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Track if form has changes
  const hasChanges = React.useMemo(() => {
    return (
      title !== item.title ||
      description !== (item.description || "") ||
      priority !== (item.priority || "medium") ||
      storyPoints !== (item.storyPoints?.toString() || "") ||
      acceptanceCriteria !== (item.acceptanceCriteria?.join("\n") || "")
    );
  }, [title, description, priority, storyPoints, acceptanceCriteria, item]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    setIsSaving(true);
    try {
      // Parse acceptance criteria
      const criteria = acceptanceCriteria
        .split("\n")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      updateStory(item.id, {
        title: title.trim(),
        description: description.trim(),
        priority,
        storyPoints: storyPoints ? parseInt(storyPoints, 10) : undefined,
        acceptanceCriteria: criteria.length > 0 ? criteria : undefined,
      });

      toast.success(`Updated ${typeLabels[item.type].toLowerCase()}`);
      onClose();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // Remove the item and all its children
      const idsToRemove = new Set<string>([item.id]);

      // If deleting an epic, also delete its features and stories
      if (item.type === "epic") {
        stories.forEach((s) => {
          if (s.epic === item.id) {
            idsToRemove.add(s.id);
            // Also delete stories under this feature
            stories.forEach((story) => {
              if (story.feature === s.id) {
                idsToRemove.add(story.id);
              }
            });
          }
        });
      }

      // If deleting a feature, also delete its stories
      if (item.type === "feature") {
        stories.forEach((s) => {
          if (s.feature === item.id) {
            idsToRemove.add(s.id);
          }
        });
      }

      const newStories = stories.filter((s) => !idsToRemove.has(s.id));
      setStories(newStories);

      // Restore suggestions for deleted items so they can be re-added
      idsToRemove.forEach((id) => {
        const deletedItem = stories.find((s) => s.id === id);
        if (deletedItem) {
          if (deletedItem.type === "epic") {
            restoreEpicSuggestion(id);
          } else if (deletedItem.type === "feature") {
            restoreFeatureSuggestion(id);
          } else if (deletedItem.type === "user-story" || deletedItem.type === "dev-story") {
            restoreStorySuggestion(id);
          }
        }
      });

      toast.success(`Deleted ${typeLabels[item.type].toLowerCase()}`);
      onClose();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Type badge */}
      <div className="flex items-center justify-between">
        <Badge variant="outline" className={typeBadgeColors[item.type]}>
          {typeLabels[item.type]}
        </Badge>
        <span className="text-xs text-muted-foreground">ID: {item.id}</span>
      </div>

      {/* Form fields */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="edit-title">Title *</Label>
          <Input
            id="edit-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-description">Description</Label>
          <Textarea
            id="edit-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="edit-priority">Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as "high" | "medium" | "low")}>
              <SelectTrigger id="edit-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {item.type !== "epic" && (
            <div className="space-y-2">
              <Label htmlFor="edit-points">Story Points</Label>
              <Input
                id="edit-points"
                type="number"
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
              />
            </div>
          )}
        </div>

        {(item.type === "user-story" || item.type === "dev-story") && (
          <div className="space-y-2">
            <Label htmlFor="edit-acceptance">
              {item.type === "user-story" ? "Acceptance Criteria" : "Technical Requirements"}
            </Label>
            <Textarea
              id="edit-acceptance"
              value={acceptanceCriteria}
              onChange={(e) => setAcceptanceCriteria(e.target.value)}
              rows={4}
              placeholder="One criterion per line..."
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-4 border-t">
        <Button
          onClick={handleSave}
          disabled={isSaving || !hasChanges || !title.trim()}
          className="flex-1"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="icon" disabled={isDeleting}>
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {typeLabels[item.type]}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &quot;{item.title}&quot;
                {item.type === "epic" && " and all its features and stories"}
                {item.type === "feature" && " and all its stories"}.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
