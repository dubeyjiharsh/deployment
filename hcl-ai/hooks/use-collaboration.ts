"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { nanoid } from "nanoid";
import * as Y from "yjs";
import type { BusinessCanvas } from "@/lib/validators/canvas-schema";

// User presence state
export interface UserPresence {
  id: string;
  name: string;
  clientId: string;
  color: string;
  avatar?: string;
  cursor?: { x: number; y: number } | null;
  currentTab?: string;
  activeField?: string | null;
  action?: "viewing" | "editing" | "refining";
  lastActive: number;
}

// Generate a consistent color from user ID
function userIdToColor(userId: string): string {
  const colors = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
    "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
    "#BB8FCE", "#85C1E9", "#F8B500", "#00CED1",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Throttle function for cursor updates
function throttle<Args extends unknown[]>(
  func: (...args: Args) => void,
  limit: number
): (...args: Args) => void {
  let inThrottle = false;
  return (...args: Args) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

interface UseCollaborationOptions {
  canvasId: string;
  user: {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
  };
  enabled?: boolean;
  /** Optional signed JWT for the Hocuspocus server */
  token?: string;
}

interface UseCollaborationReturn {
  isConnected: boolean;
  isEnabled: boolean;
  others: UserPresence[];
  updatePresence: (update: Partial<Omit<UserPresence, "id" | "name" | "color">>) => void;
  updateCursor: (cursor: { x: number; y: number } | null) => void;
  /**
   * Bind the shared Yjs canvas map to local state and listen for remote updates.
   */
  bindSharedCanvas: (params: {
    initialCanvas: BusinessCanvas;
    onRemoteUpdate: (canvas: BusinessCanvas) => void;
  }) => () => void;
  /**
   * Push the latest local canvas to collaborators.
   */
  broadcastCanvasUpdate: (canvas: BusinessCanvas) => void;
}

export function useCollaboration({
  canvasId,
  user,
  enabled = true,
  token,
}: UseCollaborationOptions): UseCollaborationReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [others, setOthers] = useState<UserPresence[]>([]);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const canvasMapRef = useRef<Y.Map<unknown> | null>(null);
  const isLocalUpdateRef = useRef(false); // Prevent echoing our own updates

  // Check if Hocuspocus URL is configured
  const hocuspocusUrl = process.env.NEXT_PUBLIC_HOCUSPOCUS_URL;
  const isEnabled = enabled && !!hocuspocusUrl;
  // Stable client ID so multiple tabs from the same user don't collide
  const clientIdRef = useRef<string>(nanoid());

  // Initialize connection
  useEffect(() => {
    if (!isEnabled || !canvasId || !user.id) {
      return;
    }

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const provider = new HocuspocusProvider({
      url: hocuspocusUrl,
      name: `canvas-${canvasId}`,
      document: ydoc,
      // Do not send raw user IDs as tokens; expect a real JWT from the caller if needed
      token,
      onConnect: () => {
        console.log("[Collaboration] Connected to canvas:", canvasId);
        setIsConnected(true);
      },
      onDisconnect: () => {
        console.log("[Collaboration] Disconnected from canvas:", canvasId);
        setIsConnected(false);
      },
      onClose: () => {
        setIsConnected(false);
      },
    });

    providerRef.current = provider;

    // Set initial local awareness state
    const awareness = provider.awareness;
    if (!awareness) {
      console.warn("[Collaboration] Awareness not available");
      return;
    }

    awareness.setLocalState({
      id: user.id,
      name: user.name,
      clientId: clientIdRef.current,
      avatar: user.avatar,
      color: userIdToColor(user.id),
      cursor: null,
      currentTab: "canvas",
      activeField: null,
      action: "viewing" as const,
      lastActive: Date.now(),
    });

    // Listen for awareness changes (other users)
    const handleAwarenessChange = () => {
      const states = awareness.getStates();
      const otherUsers: UserPresence[] = [];

      states.forEach((state, clientId) => {
        // Skip our own state
        if (clientId === awareness.clientID) return;
        if (!state || !state.id) return;

        const clientPresenceId = state.clientId || `client-${clientId}`;

        otherUsers.push({
          id: state.id,
          clientId: clientPresenceId,
          name: state.name || "Anonymous",
          color: state.color || userIdToColor(state.id),
          avatar: state.avatar,
          cursor: state.cursor,
          currentTab: state.currentTab,
          activeField: state.activeField,
          action: state.action || "viewing",
          lastActive: state.lastActive || Date.now(),
        });
      });

      setOthers(otherUsers);
    };

    awareness.on("change", handleAwarenessChange);
    // Initial state
    handleAwarenessChange();

    return () => {
      awareness.off("change", handleAwarenessChange);
      provider.destroy();
      ydoc.destroy();
      providerRef.current = null;
      ydocRef.current = null;
      canvasMapRef.current = null;
      setIsConnected(false);
      setOthers([]);
    };
  }, [isEnabled, canvasId, user.id, user.name, user.avatar, hocuspocusUrl, token]);

  // Update presence (tab, field, action)
  const updatePresence = useCallback(
    (update: Partial<Omit<UserPresence, "id" | "name" | "color" | "clientId">>) => {
      if (!providerRef.current?.awareness) return;

      const awareness = providerRef.current.awareness;
      const current = awareness.getLocalState() || {};
      awareness.setLocalState({
        ...current,
        ...update,
        lastActive: Date.now(),
      });
    },
    []
  );

  // Throttled cursor update (50ms)
  const updateCursor = useCallback(
    throttle((cursor: { x: number; y: number } | null) => {
      if (!providerRef.current?.awareness) return;

      const awareness = providerRef.current.awareness;
      const current = awareness.getLocalState() || {};
      awareness.setLocalState({
        ...current,
        cursor,
        lastActive: Date.now(),
      });
    }, 50),
    []
  );

  const ensureCanvasMap = useCallback((): Y.Map<unknown> | null => {
    if (!ydocRef.current) return null;
    if (!canvasMapRef.current) {
      canvasMapRef.current = ydocRef.current.getMap<unknown>("canvas");
    }
    return canvasMapRef.current;
  }, []);

  const bindSharedCanvas = useCallback((params: {
    initialCanvas: BusinessCanvas;
    onRemoteUpdate: (canvas: BusinessCanvas) => void;
  }) => {
    const { initialCanvas, onRemoteUpdate } = params;
    if (!isEnabled || !canvasId || !initialCanvas) return () => {};

    const canvasMap = ensureCanvasMap();
    if (!canvasMap) return () => {};

    const existing = canvasMap.get("data") as BusinessCanvas | undefined;

    if (existing) {
      const existingUpdatedAt = existing.updatedAt ? Date.parse(existing.updatedAt) : 0;
      const initialUpdatedAt = initialCanvas.updatedAt ? Date.parse(initialCanvas.updatedAt) : 0;

      if (existingUpdatedAt >= initialUpdatedAt) {
        onRemoteUpdate(existing);
      } else {
        isLocalUpdateRef.current = true;
        canvasMap.set("data", initialCanvas);
        isLocalUpdateRef.current = false;
      }
    } else {
      isLocalUpdateRef.current = true;
      canvasMap.set("data", initialCanvas);
      isLocalUpdateRef.current = false;
    }

    const handleChange = (_event: Y.YMapEvent<unknown>) => {
      if (isLocalUpdateRef.current) return;
      const latest = canvasMap.get("data") as BusinessCanvas | undefined;
      if (latest) {
        onRemoteUpdate(latest);
      }
    };

    canvasMap.observe(handleChange);

    return () => {
      canvasMap.unobserve(handleChange);
    };
  }, [canvasId, ensureCanvasMap, isEnabled]);

  const broadcastCanvasUpdate = useCallback((canvas: BusinessCanvas) => {
    if (!isEnabled) return;
    const canvasMap = ensureCanvasMap();
    if (!canvasMap) return;

    isLocalUpdateRef.current = true;
    canvasMap.set("data", canvas);
    isLocalUpdateRef.current = false;
  }, [ensureCanvasMap, isEnabled]);

  return {
    isConnected,
    isEnabled,
    others,
    updatePresence,
    updateCursor,
    bindSharedCanvas,
    broadcastCanvasUpdate,
  };
}
