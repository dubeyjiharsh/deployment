"use client";

import * as React from "react";
import ReactDOM from "react-dom";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Save, Download, Loader2,  Trash2, X, Sparkles, AlertTriangle, Share2, History, MoreVertical, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CanvasGrid } from "@/components/canvas/canvas-grid";
import { ChatInterface } from "@/components/chat/chat-interface";
import { ExpandCanvasDialog } from "@/components/canvas/expand-canvas-dialog";
import { VersionHistory } from "@/components/canvas/version-history";
import { ConflictBanner } from "@/components/canvas/conflict-banner";
import { CommentsDrawer } from "@/components/canvas/comments-drawer";
import { ShareCanvasDialog } from "@/components/canvas/share-canvas-dialog";
import { ExportCanvasDialog } from "@/components/canvas/export-canvas-dialog";
import { AvatarStack } from "@/components/collaboration";
import { useCanvasStore } from "@/stores/canvas-store";
import type { ConflictResolution } from "@/stores/canvas-store";
import { useCollaboration } from "@/hooks/use-collaboration";
import { getFieldLabel, formatStatus } from "@/lib/utils/canvas-helpers";
import { nanoid } from "nanoid";
import type { BusinessCanvas, ChatMessage } from "@/lib/validators/canvas-schema";
import type { CanvasVersion } from "@/services/database/canvas-versions-repository";

interface CanvasPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Canvas detail page with editing and chat interface
 */
export default function CanvasPage({ params }: CanvasPageProps): React.ReactElement {
  const resolvedParams = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const {
    currentCanvas,
    setCurrentCanvas,
    activeField,
    setActiveField,
    messages,
    addMessage,
    setSaving,
    isSaving,
    conflicts,
    setConflicts,
    isDetectingConflicts,
    setDetectingConflicts,
    resolveConflict,
    updateConflictResolution,
    addAuditLogEntry,
    auditLog,
    stories,
    executionPlan,
    benchmarks,
  } = useCanvasStore();

  // Real-time collaboration
  const collaborationUser = React.useMemo(() => ({
    id: session?.user?.id || "anonymous",
    name: session?.user?.name || "Anonymous",
    email: session?.user?.email || undefined,
    teamId: session?.user?.teamId || null,
  }), [session?.user?.id, session?.user?.name, session?.user?.email, session?.user?.teamId]);

  // Collaboration token for secure Hocuspocus connection
  const [collaborationToken, setCollaborationToken] = React.useState<string | undefined>(undefined);

  // Fetch collaboration token when canvas ID and session are available
  React.useEffect(() => {
    const fetchCollaborationToken = async () => {
      if (!session?.user?.id || !resolvedParams.id) return;

      try {
        const response = await fetch("/api/collaboration/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ canvasId: resolvedParams.id }),
        });

        if (response.ok) {
          const { token } = await response.json();
          setCollaborationToken(token);
        } else {
          console.warn("[Collaboration] Failed to fetch token:", response.status);
        }
      } catch (error) {
        console.error("[Collaboration] Error fetching token:", error);
      }
    };

    fetchCollaborationToken();
  }, [session?.user?.id, resolvedParams.id]);

  const {
    isConnected: isCollabConnected,
    isEnabled: isCollabEnabled,
    others: collaborators,
    updatePresence,
    updateCursor,
    bindSharedCanvas,
    broadcastCanvasUpdate,
  } = useCollaboration({
    canvasId: resolvedParams.id,
    user: collaborationUser,
    enabled: !!session?.user && !!collaborationToken,
    token: collaborationToken,
  });

  const [isLoading, setIsLoading] = React.useState(true);
  const [isChatLoading, setIsChatLoading] = React.useState(false);
  const [headerPortal, setHeaderPortal] = React.useState<HTMLElement | null>(null);
  const [actionsPortal, setActionsPortal] = React.useState<HTMLElement | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [showExpandDialog, setShowExpandDialog] = React.useState(false);
  const [showShareDialog, setShowShareDialog] = React.useState(false);
  const [showVersionHistory, setShowVersionHistory] = React.useState(false);
  const [showExportDialog, setShowExportDialog] = React.useState(false);
  const [activeCommentsField, setActiveCommentsField] = React.useState<string | null>(null);
  const [commentCounts, setCommentCounts] = React.useState<Record<string, number>>({});
  const [activeCanvasTab, setActiveCanvasTab] = React.useState("canvas");
  const [followingClientId, setFollowingClientId] = React.useState<string | null>(null); // Specific client we're following
  const [fieldConfiguration, setFieldConfiguration] = React.useState<Array<{
    id: string;
    name: string;
    fieldKey: string;
    enabled: boolean;
    includeInGeneration?: boolean;
    order: number;
    type: string;
    description?: string;
  }>>([]);
  const currentCanvasRef = React.useRef<BusinessCanvas | null>(null);
  const isApplyingRemoteCanvasRef = React.useRef(false);
  const boundCanvasIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    setHeaderPortal(document.getElementById("page-header"));
    setActionsPortal(document.getElementById("page-actions"));
  }, []);

  // Get the user we're currently following
  const followedUser = React.useMemo(() => {
    if (!followingClientId) return null;
    return collaborators.find(u => (u.clientId || u.id) === followingClientId) || null;
  }, [followingClientId, collaborators]);
  const lastFollowScrollRef = React.useRef<number>(0);

  // Follow mode: switch to the followed user's tab when they change tabs
  React.useEffect(() => {
    if (!followedUser) return;

    // Switch to the same tab as the followed user
    if (followedUser.currentTab && followedUser.currentTab !== activeCanvasTab) {
      setActiveCanvasTab(followedUser.currentTab);
    }
  }, [followedUser, followedUser?.currentTab, activeCanvasTab]);

  // Follow mode: scroll to followed user's cursor position
  React.useEffect(() => {
    const cursor = followedUser?.cursor;
    if (!cursor) return;

    const now = Date.now();
    // Avoid over-scrolling when rapid cursor updates come in
    if (now - lastFollowScrollRef.current < 80) return;
    lastFollowScrollRef.current = now;

    // Only scroll if the followed cursor is outside our current viewport (with a small buffer)
    const padding = 120;
    const viewportTop = window.scrollY;
    const viewportBottom = viewportTop + window.innerHeight;
    const targetY = cursor.y;

    if (targetY < viewportTop + padding || targetY > viewportBottom - padding) {
      window.scrollTo({
        top: Math.max(0, targetY - window.innerHeight / 2),
        left: Math.max(0, cursor.x - window.innerWidth / 2),
        behavior: 'smooth'
      });
    }
  }, [followedUser?.cursor]);

  // Stop following if the user disconnects
  React.useEffect(() => {
    if (followingClientId) {
      const stillConnected = collaborators.some(
        (u) => (u.clientId || u.id) === followingClientId
      );
      if (!stillConnected) {
        setFollowingClientId(null);
      }
    }
  }, [followingClientId, collaborators]);

  // Handle clicking on a user avatar to follow them
  const handleFollowUser = React.useCallback((user: { id: string; clientId?: string; currentTab?: string }) => {
    const targetId = user.clientId || user.id;
    if (followingClientId === targetId) {
      // Already following, stop following
      setFollowingClientId(null);
    } else {
      // Start following this user
      setFollowingClientId(targetId);
      // Immediately switch to their tab
      if (user.currentTab) {
        setActiveCanvasTab(user.currentTab);
      }
    }
  }, [followingClientId]);

  // Helper function to track refinements
  const trackRefinement = async (
    fieldKey: string,
    beforeValue: unknown,
    afterValue: unknown,
    instruction: string
  ): Promise<void> => {
    try {
      // Fetch current industry from settings
      const settingsResponse = await fetch("/api/settings");
      const settings = settingsResponse.ok ? await settingsResponse.json() : null;
      const industry = settings?.industry || "other";

      await fetch("/api/canvas/refinement-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId: currentCanvas?.id,
          fieldKey,
          fieldLabel: getFieldLabel(fieldKey),
          beforeValue,
          afterValue,
          instruction,
          industry,
        }),
      });
    } catch (error) {
      console.error("Failed to track refinement:", error);
      // Don't fail the operation if tracking fails
    }
  };

  // Lock body scroll when drawer is open
  React.useEffect(() => {
    if (activeField !== null) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [activeField]);

  // Update collaboration presence when activeField changes
  React.useEffect(() => {
    if (!isCollabEnabled) return;

    updatePresence({
      activeField: activeField,
      action: activeField ? "refining" : "viewing",
    });
  }, [activeField, isCollabEnabled, updatePresence]);

  // Track cursor movement for collaboration
  React.useEffect(() => {
    if (!isCollabEnabled || !isCollabConnected) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateCursor({ x: e.pageX, y: e.pageY });
    };

    const handleMouseLeave = () => {
      updateCursor(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [isCollabEnabled, isCollabConnected, updateCursor]);

  React.useEffect(() => {
    currentCanvasRef.current = currentCanvas;
  }, [currentCanvas]);

  React.useEffect(() => {
    if (!isCollabEnabled || !currentCanvas) return;
    if (boundCanvasIdRef.current === currentCanvas.id) return;

    const cleanup = bindSharedCanvas({
      initialCanvas: currentCanvas,
      onRemoteUpdate: (incomingCanvas) => {
        const local = currentCanvasRef.current;
        if (local && incomingCanvas.id !== local.id) return;

        const incomingUpdatedAt = incomingCanvas.updatedAt ? Date.parse(incomingCanvas.updatedAt) : 0;
        const localUpdatedAt = local?.updatedAt ? Date.parse(local.updatedAt) : 0;

        if (local && !Number.isNaN(localUpdatedAt) && incomingUpdatedAt <= localUpdatedAt) {
          return; // Ignore stale updates
        }

        isApplyingRemoteCanvasRef.current = true;
        setCurrentCanvas(incomingCanvas);
        setTimeout(() => {
          isApplyingRemoteCanvasRef.current = false;
        }, 0);
      },
    });

    boundCanvasIdRef.current = currentCanvas.id;

    return () => {
      boundCanvasIdRef.current = null;
      cleanup();
    };
  }, [bindSharedCanvas, currentCanvas, isCollabEnabled, setCurrentCanvas]);

  React.useEffect(() => {
    if (!isCollabEnabled || !currentCanvas) return;
    if (isApplyingRemoteCanvasRef.current) return;
    broadcastCanvasUpdate(currentCanvas);
  }, [broadcastCanvasUpdate, currentCanvas, isCollabEnabled]);

  React.useEffect(() => {
    const fetchCanvas = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/canvas/${resolvedParams.id}`);

        if (!response.ok) {
          throw new Error("Failed to fetch canvas");
        }

        const canvas: BusinessCanvas = await response.json();
        setCurrentCanvas(canvas);
      } catch (error) {
        console.error("Error fetching canvas:", error);
        alert("Failed to load canvas");
        router.push("/");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCanvas();
  }, [resolvedParams.id, setCurrentCanvas, router]);

  // Fetch comment counts
  React.useEffect(() => {
    const fetchCommentCounts = async (): Promise<void> => {
      if (!currentCanvas) return;

      try {
        const response = await fetch(
          `/api/canvas/comments?canvasId=${currentCanvas.id}&counts=true`
        );

        if (response.ok) {
          const { commentCounts: counts } = await response.json();
          setCommentCounts(counts || {});
        }
      } catch (error) {
        console.error("Failed to fetch comment counts:", error);
      }
    };

    fetchCommentCounts();
  }, [currentCanvas]);

  // Listen for conflict resolution updates
  React.useEffect(() => {
    const handleUpdateResolution = (event: Event) => {
      const customEvent = event as CustomEvent<{
        conflictId: string;
        resolution: ConflictResolution;
      }>;
      updateConflictResolution(
        customEvent.detail.conflictId,
        customEvent.detail.resolution
      );
    };

    window.addEventListener("updateConflictResolution", handleUpdateResolution);

    return () => {
      window.removeEventListener(
        "updateConflictResolution",
        handleUpdateResolution
      );
    };
  }, [updateConflictResolution]);

  const handleSaveCanvas = async (): Promise<void> => {
    if (!currentCanvas) return;

    setSaving(true);

    try {
      const response = await fetch(`/api/canvas/${currentCanvas.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(currentCanvas),
      });

      if (!response.ok) {
        throw new Error("Failed to save canvas");
      }

      alert("Canvas saved successfully!");
    } catch (error) {
      console.error("Error saving canvas:", error);
      alert("Failed to save canvas");
    } finally {
      setSaving(false);
    }
  };

  const handleSendMessage = async (messageText: string, attachments?: Array<{
    id: string;
    name: string;
    type: string;
    size: number;
    content: string;
  }>): Promise<void> => {
    if (!currentCanvas || !activeField) return;

    setIsChatLoading(true);

    // Add user message
    const userMessage: ChatMessage = {
      id: nanoid(),
      role: "user",
      content: messageText,
      canvasId: currentCanvas.id,
      fieldName: activeField,
      timestamp: new Date().toISOString(),
      attachments,
    };
    addMessage(userMessage);

    try {
      // Build conversation history from messages
      const conversationHistory = messages
        .filter(m => m.fieldName === activeField)
        .map(m => ({
          role: m.role,
          content: m.content,
        }));

      // Call conversational refinement API with full canvas context
      const response = await fetch("/api/canvas/refine-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId: currentCanvas.id,
          fieldKey: activeField,
          fieldLabel: getFieldLabel(activeField),
          currentValue: (currentCanvas[activeField as keyof BusinessCanvas] as Record<string, unknown>)?.value,
          conversationHistory,
          userMessage: messageText,
          fullCanvasContext: currentCanvas, // Pass entire canvas for better context
          attachments, // Pass attachments for AI to analyze
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to refine field");
      }

      const { message, refinedValue, hasRefinedValue, relatedFieldSuggestions, hasRelatedSuggestions } = await response.json();

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: nanoid(),
        role: "assistant",
        content: message,
        canvasId: currentCanvas.id,
        fieldName: activeField,
        timestamp: new Date().toISOString(),
      };
      addMessage(assistantMessage);

      // If AI has a refined value ready, automatically update the canvas
      if (hasRefinedValue && refinedValue !== null) {
        console.log("Applying refined value:", refinedValue);
        console.log("Related field suggestions:", relatedFieldSuggestions);

        const beforeValue = (currentCanvas[activeField as keyof BusinessCanvas] as Record<string, unknown>)?.value;

        let updatedCanvas = {
          ...currentCanvas,
          [activeField]: {
            ...(currentCanvas[activeField as keyof BusinessCanvas] as Record<string, unknown>),
            value: refinedValue,
          },
          updatedAt: new Date().toISOString(),
        };

        // If there are related field suggestions, apply them as well
        if (hasRelatedSuggestions && relatedFieldSuggestions) {
          for (const [fieldKey, suggestion] of Object.entries(relatedFieldSuggestions)) {
            const typedSuggestion = suggestion as {
              fieldLabel: string;
              suggestedValue: unknown;
              reason: string;
            };

            updatedCanvas = {
              ...updatedCanvas,
              [fieldKey]: {
                ...(updatedCanvas[fieldKey as keyof BusinessCanvas] as Record<string, unknown>),
                value: typedSuggestion.suggestedValue,
              },
            };
          }
        }

        // Save to database
        const saveResponse = await fetch(`/api/canvas/${currentCanvas.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedCanvas),
        });

        if (saveResponse.ok) {
          setCurrentCanvas(updatedCanvas);

          // Track refinement for learning
          await trackRefinement(activeField, beforeValue, refinedValue, messageText);
          
          // Log to audit trail
          const relatedFields = hasRelatedSuggestions && relatedFieldSuggestions 
            ? Object.keys(relatedFieldSuggestions) 
            : [];
          
          await addAuditLogEntry({
            canvasId: currentCanvas.id,
            action: "refine_field",
            description: `Refined field via chat: ${getFieldLabel(activeField)}${relatedFields.length > 0 ? ` (and ${relatedFields.length} related field${relatedFields.length > 1 ? 's' : ''})` : ''}`,
            metadata: {
              fieldKey: activeField,
              fieldLabel: getFieldLabel(activeField),
              beforeValue: typeof beforeValue === 'object' ? JSON.stringify(beforeValue) : String(beforeValue || ''),
              afterValue: typeof refinedValue === 'object' ? JSON.stringify(refinedValue) : String(refinedValue || ''),
              userInstruction: messageText,
              relatedFields: relatedFields,
            }
          });

          // Build confirmation message
          let confirmationText = "✅ Field updated successfully!";
          if (hasRelatedSuggestions && relatedFieldSuggestions) {
            const updatedFields = Object.entries(relatedFieldSuggestions)
              .map(([_, suggestion]) => (suggestion as { fieldLabel: string }).fieldLabel)
              .join(", ");
            confirmationText += `\n\n✨ Also updated related fields: ${updatedFields}`;
          }

          // Add confirmation message
          const confirmMessage: ChatMessage = {
            id: nanoid(),
            role: "assistant",
            content: confirmationText,
            canvasId: currentCanvas.id,
            fieldName: activeField,
            timestamp: new Date().toISOString(),
          };
          addMessage(confirmMessage);
        }
      }
    } catch (error) {
      console.error("Error refining field:", error);

      const errorMessage: ChatMessage = {
        id: nanoid(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        canvasId: currentCanvas.id,
        fieldName: activeField,
        timestamp: new Date().toISOString(),
      };
      addMessage(errorMessage);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleDeleteCanvas = async (): Promise<void> => {
    if (!currentCanvas) return;

    try {
      const response = await fetch(`/api/canvas/${currentCanvas.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete canvas");
      }

      // Navigate home and refresh to update sidebar
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Error deleting canvas:", error);
      alert("Failed to delete canvas");
    }
  };

  const handleExpandCanvas = async (selectedFields: string[]): Promise<void> => {
    if (!currentCanvas) return;

    try {
      const response = await fetch("/api/canvas/expand", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          canvasId: currentCanvas.id,
          fields: selectedFields,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to expand canvas");
      }

      const expandedCanvas: BusinessCanvas = await response.json();
      setCurrentCanvas(expandedCanvas);
      alert("Canvas expanded successfully!");
    } catch (error) {
      console.error("Error expanding canvas:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to expand canvas. Please try again.";
      alert(errorMessage);
    }
  };

  const getExistingOptionalFields = (): string[] => {
    if (!currentCanvas) return [];

    const optionalFieldKeys = [
      "stakeholderMap",
      "budgetResources",
      "successCriteria",
      "assumptions",
      "technicalArchitecture",
      "securityCompliance",
      "changeManagement",
      "roiAnalysis",
    ];

    return optionalFieldKeys.filter((key) => {
      const field = currentCanvas[key as keyof BusinessCanvas];
      return field && typeof field === "object" && "value" in field && field.value !== null;
    });
  };

  const handleRestoreVersion = async (version: CanvasVersion): Promise<void> => {
    try {
      // Restore creates a new version with the old data
      const restoredCanvas = {
        ...version.data,
        updatedAt: new Date().toISOString(),
      };

      const response = await fetch(`/api/canvas/${restoredCanvas.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(restoredCanvas),
      });

      if (!response.ok) {
        throw new Error("Failed to restore version");
      }

      setCurrentCanvas(restoredCanvas);
      alert(`Restored to version ${version.versionNumber}`);
    } catch (error) {
      console.error("Error restoring version:", error);
      alert("Failed to restore version");
    }
  };

  const handleDetectConflicts = async (): Promise<void> => {
    if (!currentCanvas) return;

    try {
      setDetectingConflicts(true);

      const response = await fetch("/api/canvas/detect-conflicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasId: currentCanvas.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to detect conflicts");
      }

      const { conflicts: detectedConflicts } = await response.json();
      setConflicts(detectedConflicts);

      if (detectedConflicts.length === 0) {
        alert("No conflicts detected! Your canvas looks good.");
      }
    } catch (error) {
      console.error("Error detecting conflicts:", error);
      alert("Failed to detect conflicts");
    } finally {
      setDetectingConflicts(false);
    }
  };

  const handleResolveConflict = (conflictId: string): void => {
    resolveConflict(conflictId);
  };

  const handleDismissConflicts = (): void => {
    // Mark all conflicts as resolved
    conflicts.forEach((conflict) => {
      if (!conflict.resolved) {
        resolveConflict(conflict.id);
      }
    });
  };

  const handleStatusChange = async (newStatus: BusinessCanvas["status"]): Promise<void> => {
    if (!currentCanvas) return;

    try {
      const updatedCanvas = {
        ...currentCanvas,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };

      const response = await fetch(`/api/canvas/${currentCanvas.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedCanvas),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      setCurrentCanvas(updatedCanvas);
      alert(`Status updated to ${newStatus}`);
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status");
    }
  };

  const handleApplyFix = async (
    conflictId: string,
    resolution: ConflictResolution
  ): Promise<void> => {
    if (!currentCanvas) return;

    try {
      // Apply the fix via API
      const response = await fetch("/api/canvas/resolve-conflict", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId: currentCanvas.id,
          suggestedChanges: resolution.suggestedChanges,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to apply fix");
      }

      const { canvas: updatedCanvas } = await response.json();

      // Update canvas in store
      setCurrentCanvas(updatedCanvas);

      alert("Conflict resolved! Canvas has been updated.");
    } catch (error) {
      console.error("Failed to apply fix:", error);
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentCanvas) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">Canvas not found</p>
          <Button onClick={() => router.push("/")} className="mt-4">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {headerPortal && ReactDOM.createPortal(
        <div className="flex items-center gap-3">
          <h1 className="text-base font-medium truncate max-w-[300px]">
            {currentCanvas.title.value || "Untitled Canvas"}
          </h1>
        </div>,
        headerPortal
      )}

      {actionsPortal && ReactDOM.createPortal(
        <div className="flex items-center gap-3">
          {/* Following indicator */}
          {followedUser && (
            <div
              className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium text-white animate-pulse cursor-pointer"
              style={{ backgroundColor: followedUser.color }}
              onClick={() => setFollowingClientId(null)}
              title="Click to stop following"
            >
              <span>Following {followedUser.name.split(' ')[0]}</span>
              <X className="h-3 w-3" />
            </div>
          )}

          {/* Collaboration avatars - only shown when connected */}
          {isCollabEnabled && collaborators.length > 0 && (
            <AvatarStack
              users={collaborators}
              maxVisible={4}
              onUserClick={handleFollowUser}
            />
          )}

          <ButtonGroup className="rounded-md px-2 py-1 [&>button]:bg-[var(--button-group-bg)] [&>button]:border-transparent [&>button:hover]:bg-accent [&>button:hover]:text-accent-foreground [&>button:hover]:[&_svg]:text-accent-foreground [&>button:hover]:border-accent [&>button:hover]:shadow-md [&>button:hover]:z-10 [&>button:hover]:relative [&>button:hover]:scale-[1.02]">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveCanvas}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowShareDialog(true)}
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <CheckCircle2 className="h-4 w-4" />
                Status: {formatStatus(currentCanvas.status)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleStatusChange("draft")}>
                Draft
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange("in_review")}>
                In Review
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange("approved")}>
                Approved
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange("rejected")}>
                Rejected
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExpandDialog(true)}
          >
            <Sparkles className="h-4 w-4" />
            Additional Fields
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="px-2" aria-label="More options">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowVersionHistory(true)}>
                <History />
                Version History
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDetectConflicts} disabled={isDetectingConflicts}>
                {isDetectingConflicts ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <AlertTriangle />
                )}
                Detect Conflicts
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowExportDialog(true)}>
                <Download />
                Export
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} variant="destructive">
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
        </div>,
        actionsPortal
      )}

      <div className="p-6">
        <ConflictBanner
          conflicts={conflicts}
          canvasId={currentCanvas.id}
          onResolve={handleResolveConflict}
          onApplyFix={handleApplyFix}
          onDismiss={handleDismissConflicts}
        />
        <CanvasGrid
          canvas={currentCanvas}
          viewMode="table"
          onFieldConfigLoaded={setFieldConfiguration}
          commentCounts={commentCounts}
          onOpenComments={(fieldKey) => setActiveCommentsField(fieldKey)}
          collaborators={collaborators}
          onPresenceUpdate={updatePresence}
          onTabChange={setActiveCanvasTab}
          activeTab={activeCanvasTab}
          enableMcpCheck={session?.user?.role === "admin"}
          userTeamId={session?.user?.teamId || null}
          userRole={session?.user?.role ?? null}
          permissionRole={(currentCanvas as Record<string, unknown>)?.sharedRole as "owner" | "editor" | "viewer" | null}
          isCollabEnabled={isCollabEnabled}
        />
      </div>

      <Drawer
        open={activeField !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActiveField(null);
            // Clear presence when closing refine drawer
            updatePresence({ action: "viewing", activeField: null });
          }
        }}
        direction="right"
      >
        <DrawerContent className="h-full w-full sm:max-w-2xl ml-auto [&>div:first-child]:hidden">
          <DrawerHeader className="relative text-left">
            <DrawerClose asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute right-4 top-4"
              >
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
            <DrawerTitle>
              Refining: {activeField ? getFieldLabel(activeField) : ""}
            </DrawerTitle>
            <DrawerDescription>
              Chat with AI to refine this field. The AI has full context of your canvas and will help you improve it.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden px-4 pb-4">
            {activeField && (
              <div className="h-full border rounded-lg bg-card">
                <ChatInterface
                  messages={messages.filter(m => m.fieldName === activeField)}
                  onSendMessage={handleSendMessage}
                  isLoading={isChatLoading}
                  fieldName={getFieldLabel(activeField)}
                  fieldKey={activeField}
                />
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Canvas</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this canvas? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCanvas}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExpandCanvasDialog
        isOpen={showExpandDialog}
        onClose={() => setShowExpandDialog(false)}
        onExpand={handleExpandCanvas}
        existingFields={getExistingOptionalFields()}
        fieldConfiguration={fieldConfiguration}
      />

      <ShareCanvasDialog
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        canvasId={currentCanvas.id}
      />

      <ExportCanvasDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        canvasId={currentCanvas.id}
        canvasTitle={currentCanvas.title?.value || "Business Canvas"}
        hasResearch={!!currentCanvas.research}
        hasStories={stories.length > 0}
        hasBenchmarks={benchmarks.length > 0}
        hasExecutionPlan={!!executionPlan && (executionPlan.sprints.length > 0 || executionPlan.resources.length > 0)}
        stories={stories}
        benchmarks={benchmarks}
        executionPlan={executionPlan}
      />

      <Drawer
        open={showVersionHistory}
        onOpenChange={setShowVersionHistory}
        direction="right"
      >
        <DrawerContent className="h-full w-full sm:max-w-2xl ml-auto [&>div:first-child]:hidden">
          <DrawerHeader className="relative text-left">
            <DrawerClose asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute right-4 top-4"
              >
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
            <DrawerTitle>Version History & Audit Log</DrawerTitle>
            <DrawerDescription>
              View and restore previous versions, or track changes with the audit log
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-auto px-6 pb-6">
            <VersionHistory
              canvasId={currentCanvas.id}
              onRestoreVersion={handleRestoreVersion}
              auditLog={auditLog}
              embedded={true}
              isOpen={showVersionHistory}
              onOpenChange={setShowVersionHistory}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={activeCommentsField !== null}
        onOpenChange={(open) => !open && setActiveCommentsField(null)}
        direction="right"
      >
        <DrawerContent className="h-full w-full sm:max-w-2xl ml-auto [&>div:first-child]:hidden">
          <DrawerHeader className="sr-only">
            <DrawerTitle>
              Comments: {activeCommentsField ? getFieldLabel(activeCommentsField) : "Field Comments"}
            </DrawerTitle>
            <DrawerDescription>
              Discuss and collaborate on this field with your team
            </DrawerDescription>
          </DrawerHeader>
          {activeCommentsField && currentCanvas && (
            <CommentsDrawer
              canvasId={currentCanvas.id}
              fieldKey={activeCommentsField}
              fieldLabel={getFieldLabel(activeCommentsField)}
              onClose={() => setActiveCommentsField(null)}
            />
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
