"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useCanvasStore } from "@/stores/canvas-store";
import type { BusinessCanvas } from "@/lib/validators/canvas-schema";
import { EpicsBoardProvider, useEpicsBoardContext } from "./EpicsBoardContext";
import { BoardContainer } from "./board/BoardContainer";
import { EpicColumn } from "./board/EpicColumn";
import { FeatureCard } from "./board/FeatureCard";
import { StoryItem } from "./board/StoryItem";
import { EmptyState } from "./board/EmptyState";
import { AddPlaceholder } from "./board/AddPlaceholder";
import { EpicsSidebar } from "./sidebar/EpicsSidebar";

interface EpicsBoardProps {
  canvas: BusinessCanvas;
  isJiraConnected?: boolean;
  isExportingToJira?: boolean;
  onExportToJira?: () => void;
  onClearStories?: () => void;
}

function EpicsBoardInner({ canvas }: EpicsBoardProps) {
  const stories = useCanvasStore((state) => state.stories);
  const setStories = useCanvasStore((state) => state.setStories);
  const { openSidebar } = useEpicsBoardContext();
  const [activeId, setActiveId] = React.useState<string | null>(null);

  // Filter stories by type
  const epics = React.useMemo(
    () => stories.filter((s) => s.type === "epic"),
    [stories]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || active.id === over.id) return;

      // Check if we're dragging an epic
      const activeEpic = epics.find((e) => e.id === active.id);
      const overEpic = epics.find((e) => e.id === over.id);

      if (activeEpic && overEpic) {
        // Reordering epics
        const oldIndex = epics.findIndex((e) => e.id === active.id);
        const newIndex = epics.findIndex((e) => e.id === over.id);

        if (oldIndex !== newIndex) {
          const newEpics = arrayMove(epics, oldIndex, newIndex);
          // Update order in stories array
          const nonEpics = stories.filter((s) => s.type !== "epic");
          setStories([...newEpics, ...nonEpics]);
        }
      }
    },
    [epics, stories, setStories]
  );

  const activeItem = activeId ? stories.find((s) => s.id === activeId) : null;

  // Empty state
  if (epics.length === 0) {
    return (
      <>
        <EmptyState onAddEpic={() => openSidebar("add-epic")} />
        <EpicsSidebar canvas={canvas} />
      </>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <BoardContainer>
          <SortableContext
            items={epics.map((e) => e.id)}
            strategy={horizontalListSortingStrategy}
          >
            {epics.map((epic) => (
              <EpicColumn key={epic.id} epic={epic} allStories={stories} />
            ))}
          </SortableContext>

          {/* Add Epic placeholder */}
          <AddPlaceholder
            type="epic"
            onClick={() => openSidebar("add-epic")}
          />
        </BoardContainer>

        {/* Drag overlay for smooth dragging */}
        <DragOverlay>
          {activeItem ? (
            activeItem.type === "epic" ? (
              <EpicColumn
                epic={activeItem}
                allStories={stories}
                isDragOverlay
              />
            ) : activeItem.type === "feature" ? (
              <FeatureCard
                feature={activeItem}
                userStories={stories.filter(
                  (s) => s.type === "user-story" && s.feature === activeItem.id
                )}
                devStories={stories.filter(
                  (s) => s.type === "dev-story" && s.feature === activeItem.id
                )}
                isDragOverlay
              />
            ) : (
              <StoryItem story={activeItem} isDragOverlay />
            )
          ) : null}
        </DragOverlay>
      </DndContext>

      <EpicsSidebar canvas={canvas} />
    </>
  );
}

export function EpicsBoard(props: EpicsBoardProps) {
  return (
    <EpicsBoardProvider canvasId={props.canvas.id}>
      <EpicsBoardInner {...props} />
    </EpicsBoardProvider>
  );
}
