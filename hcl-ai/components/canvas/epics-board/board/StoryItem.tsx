"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, User, Code } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Story } from "@/stores/canvas-store";
import { useEpicsBoardContext } from "../EpicsBoardContext";

interface StoryItemProps {
  story: Story;
  isDragOverlay?: boolean;
}

export function StoryItem({ story, isDragOverlay }: StoryItemProps) {
  const { openSidebar } = useEpicsBoardContext();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: story.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isUserStory = story.type === "user-story";
  const Icon = isUserStory ? User : Code;

  const handleClick = () => {
    if (!isDragging) {
      openSidebar("edit", { editingItem: story });
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-start gap-2 p-2.5 rounded-md border bg-card hover:bg-accent/50 transition-colors cursor-pointer min-w-0 w-full max-w-full overflow-hidden",
        isDragging && "opacity-50",
        isDragOverlay && "shadow-lg ring-2 ring-primary"
      )}
      onClick={handleClick}
    >
      {/* Drag handle */}
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Story type icon */}
      <div
        className={cn(
          "flex items-center justify-center w-5 h-5 rounded shrink-0 mt-0.5",
          isUserStory ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
        )}
      >
        <Icon className="h-3 w-3" />
      </div>

      {/* Title */}
      <span 
        className="flex-1 text-sm leading-tight min-w-0 w-0 line-clamp-2 overflow-hidden"
        style={{
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
        }}
        title={story.title}
      >
        {story.title}
      </span>

      {/* Story points badge */}
      {story.storyPoints ? (
        <Badge
          variant="secondary"
          className="text-[10px] h-5 px-1.5 font-medium text-muted-foreground bg-muted/80 shrink-0"
        >
          {story.storyPoints}
        </Badge>
      ) : null}
    </div>
  );
}
