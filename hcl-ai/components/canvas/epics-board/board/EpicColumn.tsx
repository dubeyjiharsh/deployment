"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { GripVertical, MoreVertical, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCanvasStore, type Story } from "@/stores/canvas-store";
import { useEpicsBoardContext } from "../EpicsBoardContext";
import { FeatureCard } from "./FeatureCard";
import { AddPlaceholder } from "./AddPlaceholder";

interface EpicColumnProps {
  epic: Story;
  allStories: Story[];
  isDragOverlay?: boolean;
}

export function EpicColumn({ epic, allStories, isDragOverlay }: EpicColumnProps) {
  const { openSidebar } = useEpicsBoardContext();
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  // Store actions for delete
  const stories = useCanvasStore((state) => state.stories);
  const setStories = useCanvasStore((state) => state.setStories);
  const restoreEpicSuggestion = useCanvasStore((state) => state.restoreEpicSuggestion);
  const restoreFeatureSuggestion = useCanvasStore((state) => state.restoreFeatureSuggestion);
  const restoreStorySuggestion = useCanvasStore((state) => state.restoreStorySuggestion);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: epic.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Get features for this epic
  const features = React.useMemo(
    () => allStories.filter((s) => s.type === "feature" && s.epic === epic.id),
    [allStories, epic.id]
  );

  // Get stories grouped by feature
  const getStoriesForFeature = React.useCallback(
    (featureId: string) => {
      const stories = allStories.filter((s) => s.feature === featureId);
      return {
        userStories: stories.filter((s) => s.type === "user-story"),
        devStories: stories.filter((s) => s.type === "dev-story"),
      };
    },
    [allStories]
  );

  // Calculate total story points
  const totalPoints = React.useMemo(() => {
    let points = 0;
    features.forEach((feature) => {
      const { userStories, devStories } = getStoriesForFeature(feature.id);
      [...userStories, ...devStories].forEach((s) => {
        if (s.storyPoints) points += s.storyPoints;
      });
    });
    return points;
  }, [features, getStoriesForFeature]);

  // Handle delete epic
  const handleDelete = () => {
    // Remove the epic and all its children
    const idsToRemove = new Set<string>([epic.id]);

    // Also delete features and their stories
    stories.forEach((s) => {
      if (s.epic === epic.id) {
        idsToRemove.add(s.id);
        // Also delete stories under this feature
        stories.forEach((story) => {
          if (story.feature === s.id) {
            idsToRemove.add(story.id);
          }
        });
      }
    });

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

    toast.success("Deleted epic and all its contents");
    setShowDeleteDialog(false);
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "min-w-[400px] max-w-[400px] shrink-0 flex flex-col shadow-md border-t-4 border-t-purple-500 h-auto max-h-[calc(100vh-220px)] overflow-hidden",
        isDragging && "opacity-50",
        isDragOverlay && "shadow-xl ring-2 ring-primary cursor-grabbing"
      )}
    >
      {/* Epic header */}
      <CardHeader className="p-0 bg-card shrink-0 border-b border-accent z-10 space-y-0 min-w-0">
        {/* Top bar with drag handle, badges and actions */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            {/* Drag handle - always visible on the left */}
            <button
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-colors shrink-0"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            
            <Badge variant="outline" className="text-[10px] h-5 px-2 font-medium bg-purple-50 text-purple-700 border-purple-200">
              Epic
            </Badge>
            <Badge
              variant={
                epic.priority === "high"
                  ? "destructive"
                  : epic.priority === "medium"
                  ? "default"
                  : "secondary"
              }
              className="text-[10px] h-5 px-2 font-medium"
            >
              {epic.priority || "medium"}
            </Badge>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openSidebar("edit", { editingItem: epic })}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Epic
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Epic
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Epic?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete &quot;{epic.title}&quot; and all its features and stories.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Title */}
        <h3
          className="font-semibold text-base leading-snug cursor-pointer hover:text-primary transition-colors px-4 pb-2 min-w-0 max-w-full break-words"
          style={{
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
          }}
          onClick={() => openSidebar("edit", { editingItem: epic })}
        >
          {epic.title}
        </h3>

        {/* Description */}
        {epic.description && (
          <div className="px-4 pb-3 min-w-0 max-w-full overflow-hidden">
            <p
              className="text-sm text-muted-foreground leading-relaxed line-clamp-3 break-words max-w-full"
              style={{
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
              }}
              title={epic.description}
            >
              {epic.description}
            </p>
          </div>
        )}

        {/* Meta Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted border-t border-b text-xs text-muted-foreground">
          <span>{features.length} feature{features.length !== 1 ? "s" : ""}</span>
          <span>{totalPoints} pts total</span>
        </div>
      </CardHeader>

      {/* Features list */}
      <CardContent className="flex-1 overflow-hidden p-0 min-w-0 max-w-full">
        <ScrollArea className="h-full w-full">
          <div className="p-3 space-y-3 min-w-0 max-w-full">
            <SortableContext
              items={features.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              {features.map((feature) => {
                const { userStories, devStories } = getStoriesForFeature(feature.id);
                return (
                  <FeatureCard
                    key={feature.id}
                    feature={feature}
                    userStories={userStories}
                    devStories={devStories}
                  />
                );
              })}
            </SortableContext>

            {/* Add feature button */}
            <AddPlaceholder
              type="feature"
              onClick={() => openSidebar("add-feature", { parentEpicId: epic.id })}
            />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
