"use client";

import * as React from "react";
import { Target, Loader2, LayoutGrid, List } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCanvasStore } from "@/stores/canvas-store";
import type { BusinessCanvas } from "@/lib/validators/canvas-schema";
import { EpicsBoard } from "./epics-board";

interface StoriesTabProps {
  canvas: BusinessCanvas;
  isJiraConnected: boolean;
  isExportingToJira: boolean;
  onClearStories: () => void;
  onExportToJira: () => void;
  onGenerateEpics: () => Promise<void>;
  onGenerateFeatures: () => Promise<void>;
  onGenerateUserStories: () => Promise<void>;
}

export function StoriesTab({
  canvas,
  isJiraConnected,
  isExportingToJira,
  onClearStories,
  onExportToJira,
}: StoriesTabProps) {
  const stories = useCanvasStore((state) => state.stories);
  const [activeView, setActiveView] = React.useState<"board" | "user-stories" | "dev-stories">("board");

  // Categorize stories by type
  const epics = stories.filter((s) => s.type === "epic");
  const features = stories.filter((s) => s.type === "feature");
  const userStories = stories.filter((s) => s.type === "user-story");
  const devStories = stories.filter((s) => s.type === "dev-story");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Epics</h3>
          {epics.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {epics.length} epics
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(userStories.length > 0 || devStories.length > 0) && (
            <Button onClick={onClearStories} variant="outline" size="sm">
              Clear All
            </Button>
          )}
          {isJiraConnected && userStories.length > 0 && (
            <Button
              onClick={onExportToJira}
              disabled={isExportingToJira}
              variant="outline"
              size="sm"
            >
              {isExportingToJira ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Exporting...
                </>
              ) : (
                <>Export to Jira</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as typeof activeView)} className="w-full">
        <TabsList>
          <TabsTrigger value="board" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Board
          </TabsTrigger>
          <TabsTrigger value="user-stories" className="gap-2">
            <List className="h-4 w-4" />
            User Stories ({userStories.length})
          </TabsTrigger>
          <TabsTrigger value="dev-stories" className="gap-2">
            <List className="h-4 w-4" />
            Dev Stories ({devStories.length})
          </TabsTrigger>
        </TabsList>

        {/* Board View */}
        <TabsContent value="board" className="mt-4">
          <EpicsBoard
            canvas={canvas}
            isJiraConnected={isJiraConnected}
            isExportingToJira={isExportingToJira}
            onExportToJira={onExportToJira}
            onClearStories={onClearStories}
          />
        </TabsContent>

        {/* User Stories List View */}
        <TabsContent value="user-stories" className="mt-4 space-y-6">
          {userStories.length > 0 ? (
            epics.map((epic, epicIdx) => {
              const epicFeatures = features.filter((f) => f.epic === epic.id);
              const hasUserStories = epicFeatures.some((feature) =>
                userStories.some((story) => story.feature === feature.id)
              );

              if (!hasUserStories) return null;

              return (
                <div key={epic.id} className="border rounded-lg p-4 bg-muted/5">
                  {/* Epic Header */}
                  <div className="flex items-start gap-2 mb-4 pb-3 border-b">
                    <Badge variant="outline" className="text-xs">
                      EPIC-{epicIdx + 1}
                    </Badge>
                    <div className="flex-1">
                      <h4 className="font-semibold text-base">{epic.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{epic.description}</p>
                    </div>
                    <Badge
                      variant={
                        epic.priority === "high"
                          ? "destructive"
                          : epic.priority === "medium"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {epic.priority}
                    </Badge>
                  </div>

                  {/* Features and their Stories */}
                  <div className="space-y-4">
                    {epicFeatures.map((feature) => {
                      const featureUserStories = userStories.filter(
                        (story) => story.feature === feature.id
                      );

                      if (featureUserStories.length === 0) return null;

                      return (
                        <div key={feature.id} className="ml-4">
                          {/* Feature Header */}
                          <div className="flex items-start gap-2 mb-3">
                            <Badge variant="outline" className="text-xs">
                              FEATURE
                            </Badge>
                            <div className="flex-1">
                              <h5 className="font-medium text-sm">{feature.title}</h5>
                              <p className="text-xs text-muted-foreground mt-1">
                                {feature.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {feature.storyPoints && (
                                <Badge variant="outline" className="text-xs">
                                  {feature.storyPoints} pts
                                </Badge>
                              )}
                              <Badge
                                variant={
                                  feature.priority === "high"
                                    ? "destructive"
                                    : feature.priority === "medium"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {feature.priority}
                              </Badge>
                            </div>
                          </div>

                          {/* Stories */}
                          <div className="ml-4 space-y-3">
                            {featureUserStories.map((story) => (
                              <div
                                key={story.id}
                                className="border rounded-lg p-4 bg-card hover:shadow-md transition-shadow"
                              >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <h6 className="font-medium text-sm flex-1">{story.title}</h6>
                                  <div className="flex items-center gap-2">
                                    {story.storyPoints && (
                                      <Badge variant="outline" className="text-xs">
                                        {story.storyPoints} pts
                                      </Badge>
                                    )}
                                    <Badge
                                      variant={
                                        story.priority === "high"
                                          ? "destructive"
                                          : story.priority === "medium"
                                          ? "default"
                                          : "secondary"
                                      }
                                      className="text-xs"
                                    >
                                      {story.priority}
                                    </Badge>
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground mb-3">
                                  {story.description}
                                </p>
                                {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">
                                      Acceptance Criteria:
                                    </p>
                                    <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                                      {story.acceptanceCriteria.map((criteria, idx) => (
                                        <li key={idx}>{criteria}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center border rounded-lg bg-muted/5">
              <Target className="h-12 w-12 text-muted-foreground mb-4" />
              <h4 className="text-lg font-semibold mb-2">No User Stories Yet</h4>
              <p className="text-muted-foreground max-w-md">
                Switch to the Board view to add epics, features, and generate user stories.
              </p>
            </div>
          )}
        </TabsContent>

        {/* Dev Stories List View */}
        <TabsContent value="dev-stories" className="mt-4 space-y-6">
          {devStories.length > 0 ? (
            epics.map((epic, epicIdx) => {
              const epicFeatures = features.filter((f) => f.epic === epic.id);
              const hasDevStories = epicFeatures.some((feature) =>
                devStories.some((story) => story.feature === feature.id)
              );

              if (!hasDevStories) return null;

              return (
                <div key={epic.id} className="border rounded-lg p-4 bg-muted/5">
                  {/* Epic Header */}
                  <div className="flex items-start gap-2 mb-4 pb-3 border-b">
                    <Badge variant="outline" className="text-xs">
                      EPIC-{epicIdx + 1}
                    </Badge>
                    <div className="flex-1">
                      <h4 className="font-semibold text-base">{epic.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{epic.description}</p>
                    </div>
                    <Badge
                      variant={
                        epic.priority === "high"
                          ? "destructive"
                          : epic.priority === "medium"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {epic.priority}
                    </Badge>
                  </div>

                  {/* Features and their Stories */}
                  <div className="space-y-4">
                    {epicFeatures.map((feature) => {
                      const featureDevStories = devStories.filter(
                        (story) => story.feature === feature.id
                      );

                      if (featureDevStories.length === 0) return null;

                      return (
                        <div key={feature.id} className="ml-4">
                          {/* Feature Header */}
                          <div className="flex items-start gap-2 mb-3">
                            <Badge variant="outline" className="text-xs">
                              FEATURE
                            </Badge>
                            <div className="flex-1">
                              <h5 className="font-medium text-sm">{feature.title}</h5>
                              <p className="text-xs text-muted-foreground mt-1">
                                {feature.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {feature.storyPoints && (
                                <Badge variant="outline" className="text-xs">
                                  {feature.storyPoints} pts
                                </Badge>
                              )}
                              <Badge
                                variant={
                                  feature.priority === "high"
                                    ? "destructive"
                                    : feature.priority === "medium"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {feature.priority}
                              </Badge>
                            </div>
                          </div>

                          {/* Stories */}
                          <div className="ml-4 space-y-3">
                            {featureDevStories.map((story) => (
                              <div
                                key={story.id}
                                className="border rounded-lg p-4 bg-card hover:shadow-md transition-shadow"
                              >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <h6 className="font-medium text-sm flex-1">{story.title}</h6>
                                  <div className="flex items-center gap-2">
                                    {story.storyPoints && (
                                      <Badge variant="outline" className="text-xs">
                                        {story.storyPoints} pts
                                      </Badge>
                                    )}
                                    <Badge
                                      variant={
                                        story.priority === "high"
                                          ? "destructive"
                                          : story.priority === "medium"
                                          ? "default"
                                          : "secondary"
                                      }
                                      className="text-xs"
                                    >
                                      {story.priority}
                                    </Badge>
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground mb-3">
                                  {story.description}
                                </p>
                                {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">
                                      Technical Requirements:
                                    </p>
                                    <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                                      {story.acceptanceCriteria.map((criteria, idx) => (
                                        <li key={idx}>{criteria}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center border rounded-lg bg-muted/5">
              <Target className="h-12 w-12 text-muted-foreground mb-4" />
              <h4 className="text-lg font-semibold mb-2">No Dev Stories Yet</h4>
              <p className="text-muted-foreground max-w-md">
                Switch to the Board view to add epics, features, and generate dev stories.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
