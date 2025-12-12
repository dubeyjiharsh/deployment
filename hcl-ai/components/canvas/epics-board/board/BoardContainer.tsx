"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface BoardContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function BoardContainer({ children, className }: BoardContainerProps) {
  return (
    <div
      className={cn(
        "flex gap-6 overflow-x-auto pb-4 px-4 h-full min-h-[calc(100vh-12rem)] items-start",
        "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40",
        className
      )}
    >
      {children}
    </div>
  );
}
