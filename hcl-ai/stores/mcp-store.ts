import { create } from "zustand";
import type { McpServerConfig } from "@/lib/validators/canvas-schema";

interface McpState {
  servers: McpServerConfig[];
  isLoading: boolean;

  addServer: (server: McpServerConfig) => void;
  removeServer: (id: string) => void;
  updateServer: (id: string, updates: Partial<McpServerConfig>) => void;
  toggleServer: (id: string) => void;
  loadServers: (servers: McpServerConfig[]) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useMcpStore = create<McpState>((set) => ({
  servers: [],
  isLoading: false,

  addServer: (server) =>
    set((state) => ({ servers: [...state.servers, server] })),

  removeServer: (id) =>
    set((state) => ({
      servers: state.servers.filter((s) => s.id !== id),
    })),

  updateServer: (id, updates) =>
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),

  toggleServer: (id) =>
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s
      ),
    })),

  loadServers: (servers) => set({ servers }),

  setLoading: (isLoading) => set({ isLoading }),
}));
