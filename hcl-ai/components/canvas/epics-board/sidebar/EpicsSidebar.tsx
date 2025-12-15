"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { BusinessCanvas } from "@/lib/validators/canvas-schema";
import { useEpicsBoardContext } from "../EpicsBoardContext";
import { AddEpicContent } from "./AddEpicContent";
import { AddFeatureContent } from "./AddFeatureContent";
import { AddStoryContent } from "./AddStoryContent";
import { EditItemContent } from "./EditItemContent";

interface EpicsSidebarProps {
  canvas: BusinessCanvas;
}

const titles: Record<string, string> = {
  "add-epic": "Add Epic",
  "add-feature": "Add Feature",
  "add-story": "Add Story",
  edit: "Edit Item",
};

const descriptions: Record<string, string> = {
  "add-epic": "Choose from AI suggestions or create your own epic",
  "add-feature": "Add features to build out your epic",
  "add-story": "Break down features into actionable stories",
  edit: "Update the details of this item",
};

export function EpicsSidebar({ canvas }: EpicsSidebarProps) {
  const { sidebarOpen, sidebarMode, sidebarContext, closeSidebar } =
    useEpicsBoardContext();

  const renderContent = () => {
    switch (sidebarMode) {
      case "add-epic":
        return <AddEpicContent canvas={canvas} onClose={closeSidebar} />;
      case "add-feature":
        return (
          <AddFeatureContent
            canvas={canvas}
            epicId={sidebarContext.parentEpicId!}
            onClose={closeSidebar}
          />
        );
      case "add-story":
        return (
          <AddStoryContent
            canvas={canvas}
            featureId={sidebarContext.parentFeatureId!}
            onClose={closeSidebar}
          />
        );
      case "edit":
        return (
          <EditItemContent
            item={sidebarContext.editingItem!}
            onClose={closeSidebar}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Sheet open={sidebarOpen} onOpenChange={(open) => !open && closeSidebar()}>
      <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle>{sidebarMode ? titles[sidebarMode] : "Details"}</SheetTitle>
          <SheetDescription>
            {sidebarMode ? descriptions[sidebarMode] : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {renderContent()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
