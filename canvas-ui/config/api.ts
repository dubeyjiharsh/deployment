export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const API_ENDPOINTS = {
  canvasList: (userId: string) => `${API_BASE_URL}/api/canvas/list/${userId}`,
  canvasCreate: (userId: string) => `${API_BASE_URL}/api/canvas/create/${userId}`,
  canvasHistory: (canvasId: string) => `${API_BASE_URL}/api/canvas/${canvasId}/history`,
  canvasMessage: (canvasId: string) => `${API_BASE_URL}/api/canvas/${canvasId}/message`,
  canvasDelete: (canvasId: string) => `${API_BASE_URL}/api/canvas/${canvasId}`,
  canvasFields: (canvasId: string) => `${API_BASE_URL}/api/canvas/${canvasId}/fields`,
  canvasDownload: (canvasId: string, format: string) => `${API_BASE_URL}/api/canvas/${canvasId}/generate-document?format=${format}`,
};