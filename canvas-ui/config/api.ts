// Runtime config type definition
declare global {
  interface Window {
    APP_CONFIG: {
      KEYCLOAK_URL: string;
      KEYCLOAK_REALM: string;
      KEYCLOAK_CLIENT_ID: string;
      API_BASE_URL: string;
      BASE_PATH: string;
    };
  }
}

// Get API base URL from runtime config or fallback to env var for local dev
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined' && window.APP_CONFIG) {
    return window.APP_CONFIG.API_BASE_URL;
  }
  // Fallback for local development
  return import.meta.env.VITE_API_BASE_URL;
};

export const API_BASE_URL = getApiBaseUrl();

export const API_ENDPOINTS = {
  canvasList: (userId: string) => `${API_BASE_URL}/api/canvas/list/${userId}`,
  canvasCreate: (userId: string) => `${API_BASE_URL}/api/canvas/create/${userId}`,
  canvasHistory: (canvasId: string) => `${API_BASE_URL}/api/canvas/${canvasId}/history`,
  canvasMessage: (canvasId: string) => `${API_BASE_URL}/api/canvas/${canvasId}/message`,
  canvasDelete: (canvasId: string) => `${API_BASE_URL}/api/canvas/${canvasId}`,
  canvasFields: (canvasId: string) => `${API_BASE_URL}/api/canvas/${canvasId}/fields`,
  canvasSave : (canvasId: string) => `${API_BASE_URL}/api/canvas/${canvasId}/save_canvas`,
  canvasDownload: (canvasId: string, format: string) => `${API_BASE_URL}/api/canvas/${canvasId}/export-canvas?format=${format}`,
};

export const CONFIGURE_API_ENDPOINTS = {
  aiforce: `${API_BASE_URL}/api/openbao/configure/aiforce`,
  llm: `${API_BASE_URL}/api/openbao/configure/llm`,
};