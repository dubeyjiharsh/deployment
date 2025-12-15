"use client";

import * as React from "react";
import { Target, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onAddEpic: () => void;
}

export function EmptyState({ onAddEpic }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center border rounded-lg bg-muted/5 p-8">
      <div className="relative mb-6">
        <Target className="h-16 w-16 text-muted-foreground" />
        <Sparkles className="h-6 w-6 text-primary absolute -top-1 -right-1" />
      </div>
      <h4 className="text-xl font-semibold mb-2">Start Building Your Roadmap</h4>
      <p className="text-muted-foreground mb-6 max-w-md">
        Add epics to visualize your project roadmap. AI-powered suggestions will be generated from your OKRs and Requirements.
      </p>
      <Button onClick={onAddEpic} size="lg">
        <Plus className="h-4 w-4 mr-2" />
        Add Your First Epic
      </Button>
    </div>
  );
}
