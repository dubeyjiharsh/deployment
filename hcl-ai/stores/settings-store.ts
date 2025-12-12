import { create } from "zustand";
import type {
  CompanySettings,
  CompanyDocument,
  CompanySettingsWithDocuments,
} from "@/lib/validators/settings-schema";

// Request queue to prevent concurrent updates
let updatePromise: Promise<void> | null = null;

interface SettingsState {
  settings: CompanySettingsWithDocuments | null;
  isLoading: boolean;
  error: string | null;

  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<CompanySettings>) => Promise<void>;
  generateCompanyInfo: (companyName: string, industry: string) => Promise<string>;
  uploadDocument: (file: File) => Promise<CompanyDocument>;
  deleteDocument: (id: string) => Promise<void>;
  setSettings: (settings: CompanySettingsWithDocuments | null) => void;
  setError: (error: string | null) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  isLoading: false,
  error: null,

  fetchSettings: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch("/api/settings");

      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }

      const data = await response.json();
      set({ settings: data.settings, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      set({ error: errorMessage, isLoading: false });
    }
  },

  updateSettings: async (settings: Partial<CompanySettings>) => {
    // Wait for any pending update to complete before starting a new one
    if (updatePromise) {
      try {
        await updatePromise;
      } catch {
        // Previous request failed, continue with this one
      }
    }

    set({ isLoading: true, error: null });

    const doUpdate = async () => {
      try {
        const bodyData = JSON.stringify(settings);

        const response = await fetch("/api/settings", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: bodyData,
        });

        if (!response.ok) {
          // Try to surface server error details for easier debugging
          let message = "Failed to update settings";
          try {
            const errorBody = await response.json();
            if (errorBody?.error) {
              message = errorBody.error;
            }
          } catch {
            // Ignore JSON parse errors
          }
          throw new Error(message);
        }

        const data = await response.json();
        set({ settings: data.settings, isLoading: false });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        set({ error: errorMessage, isLoading: false });
        throw error;
      } finally {
        updatePromise = null;
      }
    };

    updatePromise = doUpdate();
    await updatePromise;
  },

  generateCompanyInfo: async (companyName: string, industry: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch("/api/settings/generate-company-info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ companyName, industry }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate company info");
      }

      const data = await response.json();
      set({ isLoading: false });
      return data.companyInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  uploadDocument: async (file: File) => {
    set({ isLoading: true, error: null });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/settings/documents", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload document");
      }

      const data = await response.json();

      const currentSettings = get().settings;
      if (currentSettings) {
        set({
          settings: {
            ...currentSettings,
            documents: [...(currentSettings.documents || []), data.document],
          },
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }

      return data.document;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  deleteDocument: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`/api/settings/documents/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete document");
      }

      const currentSettings = get().settings;
      if (currentSettings) {
        set({
          settings: {
            ...currentSettings,
            documents: currentSettings.documents?.filter((doc) => doc.id !== id),
          },
          isLoading: false,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  setSettings: (settings) => set({ settings }),
  setError: (error) => set({ error }),
}));
