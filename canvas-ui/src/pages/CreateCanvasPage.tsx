"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import axios from "axios";

export function CreateCanvasPage(): React.ReactElement {
  const [idea, setIdea] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  // Chat state: array of {role: 'user'|'assistant', content: string}
  const [chat, setChat] = React.useState<Array<{role: string, content: string}>>([]);
  // Track if file has been uploaded at least once
  const [fileUploaded, setFileUploaded] = React.useState(false);
  // Store canvas id after creation
  const [canvasId, setCanvasId] = React.useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("canvasId");
    }
    return null;
  });

  const handleFileUpload = (files: FileList | null) => {
    if (files && files.length > 0) {
      setFile(files[0]);
      setFileUploaded(true);
    }
  };

  const handleSubmit = async () => {
    if (!idea) {
      alert("Please provide a problem statement.");
      return;
    }

    // For first message, require file
    if (chat.length === 0 && !file) {
      alert("Please upload a file for the first message.");
      return;
    }

    setChat((prev) => [...prev, {role: "user", content: idea}]);
    setIsLoading(true);

    try {
      let result;
      // Always use canvasId from state/sessionStorage
      let id = canvasId;
      if (!id) {
        id = sessionStorage.getItem("canvasId");
        if (id) setCanvasId(id);
      }
      if (!id) {
        setChat((prev) => [...prev, {role: "assistant", content: "No canvas ID found. Please click 'Create New' first."}]);
        setIsLoading(false);
        setIdea("");
        return;
      }
      
      // Log request details for debugging
      console.log("Sending request with:", { canvasId: id, promptLength: idea.length, hasFile: !!file });
      
      // Always send to /api/canvas/{canvas_id}/message
      const formData = new FormData();
      formData.append("message", idea);
      if (file) {
        formData.append("files", file);
        console.log("File attached:", file.name, file.type, file.size);
      }
      console.log("*********",id)
      
      const response = await axios.post(
        `http://0.0.0.0:8020/api/canvas/${id}/message`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            "Authorization": `Bearer ${sessionStorage.getItem("authToken") || ""}`,
          },
        }
      );
      console.log("Response received:", response.data);
      result = response.data.conversation_history;
      // If the API returned a conversation_history array, use it to populate the chat UI.
      if (Array.isArray(result) && result.length > 0) {
        const mapped = result.map((m: any) => ({
          role: m.role || "assistant",
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        }));
        setChat(mapped);
      } else if (typeof response.data === "string") {
        setChat((prev) => [...prev, { role: "assistant", content: response.data }]);
      } else {
        setChat((prev) => [...prev, { role: "assistant", content: "No response" }]);
      }

      // Persist canvas JSON and id if provided
      if (response.data?.canvas_json) {
        sessionStorage.setItem("canvasJson", JSON.stringify(response.data.canvas_json));
      }
      if (response.data?.canvas_id) {
        sessionStorage.setItem("canvasId", response.data.canvas_id);
        setCanvasId(response.data.canvas_id);
      }
    } catch (error) {
      let errorMessage = "Failed to generate the business canvas. Please try again.";
      if (axios.isAxiosError(error)) {
        if (error.response) {
          const status = error.response.status;
          const data = error.response.data;
          
          if (status === 402) {
            errorMessage = `Payment Required (402): ${data?.message || "Your API quota or subscription may have expired. Please contact support."}`;
          } else if (status === 422) {
            // Handle validation errors
            let details = "";
            if (data?.detail) {
              if (Array.isArray(data.detail)) {
                details = data.detail.map((d: any) => {
                  if (d.msg) return `${d.loc?.join('.')} - ${d.msg}`;
                  return JSON.stringify(d);
                }).join("; ");
              } else {
                details = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
              }
            } else if (data?.message) {
              details = data.message;
            } else if (data?.errors) {
              details = typeof data.errors === "string" ? data.errors : JSON.stringify(data.errors);
            }
            errorMessage = `Validation Error (422): ${details || "Invalid request data. Check file format and problem statement."}`;
          } else {
            errorMessage = `Error ${status}: ${data?.message || data?.detail || JSON.stringify(data) || "Server error"}`;
          }
        } else if (error.request) {
          errorMessage = "Error: No response from server. Check if the backend is running at http://0.0.0.0:8020";
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      } else if (error instanceof Error) {
        errorMessage = `Error: ${error.message}`;
      }
      console.error("Full error details:", error);
      console.error("Request payload for debugging:", {
        idea,
        fileName: file?.name,
        fileSize: file?.size,
        canvasId: canvasId || sessionStorage.getItem("canvasId"),
      });
      setChat((prev) => [...prev, {role: "assistant", content: errorMessage}]);
    } finally {
      setIsLoading(false);
      setIdea("");
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFileUploaded(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="p-6 flex flex-col justify-between w-full max-w-3xl">
        <div className="max-w-3xl space-y-4">
          {!chat.length && (
            <div>
              <div className="text-center relative">
                <img
                  src="/images/Container.png"
                  alt="Background Container"
                  className="absolute left-1/2 top-1/2 w-[140%] max-w-none h-auto -translate-x-1/2 -translate-y-1/2 opacity-90 pointer-events-none select-none z-0"
                  style={{ filter: "none" }}
                />
                <h1 className="text-5xl font-extrabold text-blue-500 relative z-10">
                  Create Business Canvas
                </h1>
                <p className="mt-4 text-lg text-black relative z-10">
                  Describe your problem or opportunity, and our AI will help you
                  create a comprehensive business canvas
                </p>
              </div>
            </div>
          )}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload File</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <label
                htmlFor="file-upload"
                className="block text-sm font-medium text-gray-700"
              >
                Upload File
              </label>
              <input
                id="file-upload"
                type="file"
                accept=".pdf,.docx,.ppt"
                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 w-full max-w-2xl p-6 pt-0 space-y-3 bg-white bg-opacity-10 backdrop-blur-md">
          {/* Chat UI */}
          <div className="flex flex-col gap-4 mb-4">
            {chat.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] px-4 py-2 rounded-lg shadow ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-900'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
          {/* File info */}
          {file && (
            <div className="bg-white rounded-lg p-3 shadow-sm border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm text-gray-700 font-medium">{file.name}</span>
                <span className="text-xs text-gray-500">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <button
                onClick={handleRemoveFile}
                disabled={isLoading}
                className="text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          {/* Input and send */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center w-full gap-2">
              <div className="relative flex-grow" style={{ maxWidth: 'calc(100% - 48px)' }}>
                <Textarea
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="Type your message..."
                  className="bg-white bg-opacity-20 placeholder:text-black pr-28 h-20 w-full"
                  disabled={isLoading}
                />
                <div className="absolute inset-y-0 right-0 flex items-center space-x-2 pr-2">
                  <button
                    className="p-2 bg-white border rounded-full shadow disabled:opacity-50 hover:bg-gray-50 transition-colors"
                    onClick={() => document.getElementById("file-input")?.click()}
                    disabled={isLoading}
                    aria-label="Attach file"
                  >
                    <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                  <button
                    className="p-2 bg-blue-500 border border-blue-500 rounded-full shadow disabled:opacity-50 hover:bg-blue-600 transition-colors rotate-90"
                    onClick={handleSubmit}
                    disabled={isLoading || !idea || (chat.length === 0 && !file)}
                    aria-label="Send"
                  >
                    {isLoading ? (
                      <div className="h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </div>
                <input
                  id="file-input"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileUpload(e.target.files);
                    }
                  }}
                />
              </div>
              <button
                className="p-2 bg-white border rounded-full shadow disabled:opacity-50 hover:bg-gray-50 transition-colors"
                aria-label="Preview"
                tabIndex={0}
                type="button"
                onClick={() => { window.location.hash = '/canvas-preview'; }}
              >
                <img src="/dist/images/preview.png" alt="Preview" className="h-6 w-6" draggable="false" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
