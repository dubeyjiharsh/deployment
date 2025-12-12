"use client";

import * as React from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, RotateCcw, MessageCircle } from "lucide-react";
import type { CanvasVersion } from "@/services/database/canvas-versions-repository";
import type { AuditLogEntry } from "@/stores/canvas-store";
import { formatDistanceToNow } from "date-fns";

interface VersionHistoryProps {
  canvasId: string;
  onRestoreVersion?: (version: CanvasVersion) => void;
  auditLog?: AuditLogEntry[];
  /** If true, renders without Sheet wrapper (for use inside another drawer) */
  embedded?: boolean;
  /** External open state control (for embedded mode) */
  isOpen?: boolean;
  /** External open state setter (for embedded mode) */
  onOpenChange?: (open: boolean) => void;
}

export function VersionHistory({
  canvasId,
  onRestoreVersion,
  auditLog = [],
  embedded = false,
  isOpen: externalIsOpen,
  onOpenChange: externalOnOpenChange
}: VersionHistoryProps): React.ReactElement {
  const [versions, setVersions] = React.useState<CanvasVersion[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [internalIsOpen, setInternalIsOpen] = React.useState(false);
  
  // Use external state if provided, otherwise use internal state
  const isOpen = embedded ? (externalIsOpen ?? false) : internalIsOpen;
  const setIsOpen = embedded ? (externalOnOpenChange ?? (() => {})) : setInternalIsOpen;

  React.useEffect(() => {
    const fetchVersions = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/canvas/versions?canvasId=${canvasId}`);
        const data = await response.json();
        // Ensure versions is always an array
        setVersions(Array.isArray(data.versions) ? data.versions : []);
      } catch (error) {
        console.error("Failed to fetch versions:", error);
        setVersions([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch when drawer is open (either embedded or standalone)
    if (isOpen) {
      fetchVersions();
    }
  }, [isOpen, canvasId]);

  const handleRestore = (version: CanvasVersion) => {
    if (confirm(`Restore to version ${version.versionNumber}? This will create a new version with the restored data.`)) {
      onRestoreVersion?.(version);
      setIsOpen(false);
    }
  };

  const versionHistoryContent = (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : versions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No version history available
        </div>
      ) : (
        versions.map((version, index) => (
          <div key={version.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant={index === 0 ? "default" : "outline"}>
                  v{version.versionNumber}
                </Badge>
                {index === 0 && (
                  <Badge variant="secondary" className="text-xs">Current</Badge>
                )}
              </div>
              {index !== 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRestore(version)}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Restore
                </Button>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div className="text-muted-foreground">
                {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
              </div>

              {version.changeSummary && (
                <div className="text-sm">
                  {version.changeSummary}
                </div>
              )}

              {version.changedBy && (
                <div className="text-xs text-muted-foreground">
                  Changed by: {version.changedBy}
                </div>
              )}
            </div>

            <Separator className="my-3" />

            <div className="text-xs text-muted-foreground">
              <div><strong>Title:</strong> {String(version.data.title.value)}</div>
              <div className="mt-1 line-clamp-2">
                <strong>Problem:</strong> {String(version.data.problemStatement.value)}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const auditLogContent = (
    <div className="space-y-4">
      {auditLog.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
          <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h4 className="text-lg font-semibold mb-2">No Audit Trail Yet</h4>
          <p className="text-muted-foreground mb-2">
            Actions taken on this canvas will be logged here
          </p>
          <p className="text-sm text-muted-foreground max-w-md">
            The audit log provides an immutable record of all actions for compliance and traceability
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...auditLog].reverse().map((entry) => {
            const timestamp = new Date(entry.timestamp);
            const timeAgo = formatDistanceToNow(timestamp, { addSuffix: true });

            return (
              <div
                key={entry.id}
                className="border rounded-lg p-4 bg-card hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {entry.action.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {timeAgo}
                      </span>
                    </div>
                    <p className="text-sm text-foreground mb-2">{entry.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {timestamp.toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        View metadata
                      </summary>
                      <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const content = (
    <Tabs defaultValue="versions" className={embedded ? "" : "mt-6"}>
      <TabsList className="w-full">
        <TabsTrigger value="versions" className="flex-1">
          <Clock className="h-4 w-4 mr-2" />
          Version History
        </TabsTrigger>
        <TabsTrigger value="audit" className="flex-1">
          <MessageCircle className="h-4 w-4 mr-2" />
          Audit Log
          {auditLog.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {auditLog.length}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="versions" className="mt-6">
        {versionHistoryContent}
      </TabsContent>

      <TabsContent value="audit" className="mt-6">
        {auditLogContent}
      </TabsContent>
    </Tabs>
  );

  // If embedded, just return the content without Sheet wrapper
  if (embedded) {
    return content;
  }

  // Otherwise, return with Sheet wrapper
  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Clock className="h-4 w-4 mr-2" />
          Version History
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Version History & Audit Log</SheetTitle>
          <SheetDescription>
            View and restore previous versions, or track changes with the audit log
          </SheetDescription>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  );
}
