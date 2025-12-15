"use client";

import * as React from "react";
import type { Story } from "@/stores/canvas-store";

export type SidebarMode = "add-epic" | "add-feature" | "add-story" | "edit" | null;

export interface SidebarContext {
  parentEpicId?: string;
  parentFeatureId?: string;
  editingItem?: Story;
}

interface EpicsBoardContextValue {
  // Sidebar state
  sidebarOpen: boolean;
  sidebarMode: SidebarMode;
  sidebarContext: SidebarContext;

  // Actions
  openSidebar: (mode: SidebarMode, context?: SidebarContext) => void;
  closeSidebar: () => void;
}

const EpicsBoardContext = React.createContext<EpicsBoardContextValue | null>(null);

interface EpicsBoardProviderProps {
  children: React.ReactNode;
  canvasId: string;
}

export function EpicsBoardProvider({ children }: EpicsBoardProviderProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [sidebarMode, setSidebarMode] = React.useState<SidebarMode>(null);
  const [sidebarContext, setSidebarContext] = React.useState<SidebarContext>({});

  const openSidebar = React.useCallback((mode: SidebarMode, context: SidebarContext = {}) => {
    setSidebarMode(mode);
    setSidebarContext(context);
    setSidebarOpen(true);
  }, []);

  const closeSidebar = React.useCallback(() => {
    setSidebarOpen(false);
    // Delay clearing mode/context to allow exit animation
    setTimeout(() => {
      setSidebarMode(null);
      setSidebarContext({});
    }, 300);
  }, []);

  const value = React.useMemo(
    () => ({
      sidebarOpen,
      sidebarMode,
      sidebarContext,
      openSidebar,
      closeSidebar,
    }),
    [
      sidebarOpen,
      sidebarMode,
      sidebarContext,
      openSidebar,
      closeSidebar,
    ]
  );

  return (
    <EpicsBoardContext.Provider value={value}>
      {children}
    </EpicsBoardContext.Provider>
  );
}

export function useEpicsBoardContext() {
  const context = React.useContext(EpicsBoardContext);
  if (!context) {
    throw new Error("useEpicsBoardContext must be used within an EpicsBoardProvider");
  }
  return context;
}
