"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { GripVertical, ChevronDown, ChevronRight, User, Code } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Story } from "@/stores/canvas-store";
import { useEpicsBoardContext } from "../EpicsBoardContext";
import { StoryItem } from "./StoryItem";
import { AddPlaceholder } from "./AddPlaceholder";

interface FeatureCardProps {
  feature: Story;
  userStories: Story[];
  devStories: Story[];
  isDragOverlay?: boolean;
}

export function FeatureCard({
  feature,
  userStories,
  devStories,
  isDragOverlay,
}: FeatureCardProps) {
  const { openSidebar } = useEpicsBoardContext();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"user" | "dev">("user");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: feature.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleFeatureClick = (e: React.MouseEvent) => {
    // Don't open sidebar if clicking on drag handle or collapse button
    if ((e.target as HTMLElement).closest("[data-no-sidebar]")) return;
    openSidebar("edit", { editingItem: feature });
  };

  const totalStories = userStories.length + devStories.length;
  const currentStories = activeTab === "user" ? userStories : devStories;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "w-full max-w-full border rounded-lg bg-card overflow-hidden shadow-sm transition-all min-w-0",
        isDragging && "opacity-50",
        isDragOverlay && "shadow-lg ring-2 ring-primary cursor-grabbing"
      )}
    >
      {/* Feature header */}
      <div
        className="flex items-start gap-2 p-3 bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors min-w-0 max-w-full overflow-hidden"
        onClick={handleFeatureClick}
      >
        {/* Drag handle */}
        <button
          data-no-sidebar
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/80 shrink-0 mt-0.5"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        {/* Title and badge container */}
        <div className="flex-1 min-w-0 max-w-full">
          {/* Feature title */}
          <div 
            className="font-medium text-sm leading-snug min-w-0 max-w-full line-clamp-2"
            style={{
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
            }}
            title={feature.title}
          >
            {feature.title}
          </div>
          
          {/* Priority badge */}
          <Badge
            variant={
              feature.priority === "high"
                ? "destructive"
                : feature.priority === "medium"
                ? "default"
                : "secondary"
            }
            className="text-[10px] h-5 px-2 font-medium mt-1.5 inline-block"
          >
            {feature.priority || "medium"}
          </Badge>
        </div>

        {/* Collapse toggle - on the right */}
        <button
          data-no-sidebar
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(!isCollapsed);
          }}
          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/80 shrink-0 mt-0.5"
        >
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Stories content */}
      {!isCollapsed && (
        <div className="p-3 space-y-3 min-w-0 max-w-full overflow-hidden">
          {/* Tab buttons - only show if there are stories */}
          {totalStories > 0 && (
            <div className="flex p-0.5 bg-muted/60 rounded-md min-w-0 max-w-full overflow-hidden">
              <button
                onClick={() => setActiveTab("user")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-medium transition-all",
                  activeTab === "user"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <User className="h-3 w-3" />
                User ({userStories.length})
              </button>
              <button
                onClick={() => setActiveTab("dev")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-medium transition-all",
                  activeTab === "dev"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Code className="h-3 w-3" />
                Dev ({devStories.length})
              </button>
            </div>
          )}

          {/* Stories list */}
          {currentStories.length > 0 && (
            <SortableContext
              items={currentStories.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 min-w-0 w-full max-w-full overflow-hidden">
                {currentStories.map((story) => (
                  <StoryItem key={story.id} story={story} />
                ))}
              </div>
            </SortableContext>
          )}

          {/* Add story button */}
          <AddPlaceholder
            type="story"
            onClick={() =>
              openSidebar("add-story", { parentFeatureId: feature.id })
            }
          />
        </div>
      )}
    </div>
  );
}
