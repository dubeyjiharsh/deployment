"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddPlaceholderProps {
  type: "epic" | "feature" | "story";
  onClick: () => void;
  className?: string;
}

const labels: Record<AddPlaceholderProps["type"], string> = {
  epic: "Add Epic",
  feature: "Add Feature",
  story: "Add Story",
};

export function AddPlaceholder({ type, onClick, className }: AddPlaceholderProps) {
  const isEpic = type === "epic";

  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex items-center justify-center gap-1.5 rounded-md border border-dashed transition-all",
        "hover:border-primary/50 hover:bg-primary/5 cursor-pointer",
        "text-muted-foreground hover:text-primary",
        isEpic
          ? "flex-col min-w-[400px] max-w-[400px] min-h-[200px] shrink-0"
          : "w-full py-3 px-4",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-muted/50 group-hover:bg-primary/10 transition-colors",
          isEpic ? "w-10 h-10 mb-1" : "w-5 h-5"
        )}
      >
        <Plus
          className={cn(
            "transition-transform group-hover:scale-110",
            isEpic ? "h-5 w-5" : "h-3 w-3"
          )}
        />
      </div>
      <span
        className={cn(
          "font-medium whitespace-nowrap",
          isEpic ? "text-sm" : "text-xs"
        )}
      >
        {labels[type]}
      </span>
    </button>
  );
}
