"use client";
 
import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import axios from "axios";
import { navigate } from "@/lib/router";
import { API_ENDPOINTS } from '@/config/api';
import { MarkdownContent } from "./MarkdownContent";
function toMarkdownString(content: unknown): string {
  if (typeof content === "string") return content;

  // If backend sometimes sends: { text: "## hello" }
  if (
    content &&
    typeof content === "object" &&
    "text" in content &&
    typeof (content as any).text === "string"
  ) {
    return (content as any).text;
  }

  // If backend sometimes sends: { content: "## hello" }
  if (
    content &&
    typeof content === "object" &&
    "content" in content &&
    typeof (content as any).content === "string"
  ) {
    return (content as any).content;
  }

  // Fallback: show something readable (but not JSON.stringify spam)
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
}
 
export function CreateCanvasPage(): React.ReactElement {
  const [idea, setIdea] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [chat, setChat] = React.useState<Array<{role: string, content: string}>>([]);
  const [canvasId, setCanvasId] = React.useState<string | null>(null);
  const [ideaError, setIdeaError] = React.useState<string | null>(null);
  const [showPreviewAlert, setShowPreviewAlert] = React.useState(false);
  const [errorMessages, setErrorMessages] = React.useState<string[]>([]);
  

  const initialized = React.useRef(false);
 
  React.useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initPage = async () => {
      const isReturning = sessionStorage.getItem("isReturningFromPreview") === "true";
      const isEditing = sessionStorage.getItem("isEditingCanvas") === "true";
      const savedCanvasId = sessionStorage.getItem("canvasId");
      const savedChat = sessionStorage.getItem("chatState");

      if (isEditing && savedCanvasId) {
        // --- EDIT MODE: Fetch history from backend ---
        console.log("Editing canvas, fetching history:", savedCanvasId);
        setCanvasId(savedCanvasId);
        setIsLoading(true);
        try {
          const response = await axios.get(API_ENDPOINTS.canvasHistory(savedCanvasId), {
            headers: {
              Authorization: `Bearer ${sessionStorage.getItem("authToken") || ""}`,
            },
          });
          
          const history = response.data.history;
          if (Array.isArray(history)) {
            const mapped = history.map((m: any) => ({
              role: m.role || "assistant",
              content: toMarkdownString(m.content),
            }));
            setChat(mapped);
            sessionStorage.setItem("chatState", JSON.stringify(mapped));
          }
          console.log("Restored chat history from API");
        } catch (e) {
          console.error("Failed to fetch history:", e);
        } finally {
          setIsLoading(false);
          sessionStorage.removeItem("isEditingCanvas"); // Clear flag after processing
        }
      } else if (isReturning && savedCanvasId) {
        // --- RESTORE MODE (from preview) ---
        console.log("Restoring session:", savedCanvasId);
        setCanvasId(savedCanvasId);
        if (savedChat) {
          try {
            setChat(JSON.parse(savedChat));
          } catch (e) {
            console.error("Chat parse error:", e);
          }
        }
        sessionStorage.removeItem("isReturningFromPreview");
      } else {
        // --- CREATE NEW MODE ---
        console.log("Requesting fresh canvas from backend...");
        try {
          const userId = sessionStorage.getItem("userId");
          if (!userId) {
            console.error("User ID not found in session storage.");
            return;
          }

          const response = await axios.post(API_ENDPOINTS.canvasCreate(userId));
          const newId = response.data.canvas_id;
          console.log("New backend ID received:", newId);
          
          sessionStorage.removeItem("chatState");
          sessionStorage.removeItem("canvasJson");
          sessionStorage.setItem("canvasId", newId);
          
          setCanvasId(newId);
          setChat([]);
        } catch (error) {
          console.error("Failed to create new canvas:", error);
        }
      }
    };

    initPage();
  }, []);
 

  const handleFileUpload = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const allowedTypes = ["application/pdf"];
    const allowedExtensions = ["pdf"];
    const maxSizeMB = 5;
    const maxFiles = 10;

    const newErrors: string[] = [];
    let newFiles: File[] = Array.from(fileList).filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (file.size / (1024 * 1024) > maxSizeMB) {
        newErrors.push(`File ${file.name} exceeds the maximum size of ${maxSizeMB}MB.`);
        return false;
      }
      if (!allowedTypes.includes(file.type) || !ext || !allowedExtensions.includes(ext)) {
        newErrors.push(`File ${file.name} is unsupported file type.`);
        return false;
      }
      return true;
    });

    newFiles = newFiles.filter(file => !files.some(f => f.name === file.name && f.size === file.size));

    // Enforce maxFiles limit
    if (files.length + newFiles.length > maxFiles) {
      const allowedCount = Math.max(0, maxFiles - files.length);
      if (allowedCount > 0) {
        newFiles = newFiles.slice(0, allowedCount);
        newErrors.push(`You can only upload up to ${maxFiles} files. Some files were not added.`);
      } else {
        newFiles = [];
        newErrors.push(`You can only upload up to ${maxFiles} files.`);
      }
    }

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
      setShowPreviewAlert(false);
      // Ensure notification is triggered only once
      console.log(`${newFiles.length} file(s) uploaded successfully.`);
    }

    setErrorMessages(newErrors);
  };

  const handleIdeaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setIdea(value);
    if (showPreviewAlert && (value.length > 0 || files.length > 0)) {
      setShowPreviewAlert(false);
    }
    if (value.length < 10) {
      setIdeaError("Please enter at least 10 characters before sending.");
    } else {
      setIdeaError(null);
    }
  };
 
  const handleSubmit = async () => {
    if (!idea || idea.length < 10 || !canvasId) {
      setIdeaError("Please enter at least 10 characters.");
      return;
    }
    const userMsg = { role: "user", content: idea };
    setChat((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("message", idea);
      files.forEach(file => formData.append("files", file));

      const response = await axios.post(
        API_ENDPOINTS.canvasMessage(canvasId),
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${sessionStorage.getItem("authToken") || ""}`,
          },
        }
      );

      // Show chat_response in chat UI
      const chatResponse = response.data.chat_response;
      if (chatResponse) {
        setChat((prev) => [
          ...prev,
          { role: "assistant", content: toMarkdownString(chatResponse) }
        ]);
        sessionStorage.setItem("chatState", JSON.stringify([
          ...chat,
          userMsg,
          { role: "assistant", content: toMarkdownString(chatResponse) }
        ]));
      } else {
        // fallback to conversation_history if present
        const history = response.data.conversation_history;
        if (Array.isArray(history)) {
          const mapped = history.map((m: any) => ({
            role: m.role || "assistant",
            content: toMarkdownString(m.content),
          }));
          setChat(mapped);
          sessionStorage.setItem("chatState", JSON.stringify(mapped));
        }
      }
      if (response.data?.canvas_json) {
        sessionStorage.setItem("canvasJson", JSON.stringify(response.data.canvas_json));
      }
      setFiles([]);
    } catch (error) {
      console.error("Submit error:", error);
    } finally {
      setIsLoading(false);
      setIdea("");
    }
  };
 
  const handlePreview = () => {
    // Block preview if there is no chat history for this canvasId
    if (chat.length === 0) {
      setShowPreviewAlert(true);
      return;
    }
    setShowPreviewAlert(false);
    if (!canvasId) return;
    sessionStorage.setItem("chatState", JSON.stringify(chat));
    navigate(`/canvas-preview/${encodeURIComponent(canvasId)}`);
  };
 
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".error-container")) {
        setErrorMessages([]);
      }
    };

    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="p-6 flex flex-col w-full max-w-3xl h-[90vh]">
        <div className="flex-1 flex flex-col max-w-3xl space-y-4 relative overflow-hidden">
          {!chat.length && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] relative z-10 text-center">
              <img
                src="/images/Container.png"
                alt="Background Container"
                className="absolute left-1/2 top-1/2 w-[140%] max-w-none h-auto -translate-x-1/2 -translate-y-1/2 opacity-90 pointer-events-none select-none z-0"
                style={{ filter: "none" }}
              />
              <div className="relative z-10 flex flex-col items-center justify-center w-full">
                <h1 className="text-5xl font-extrabold text-blue-500">Create Business Canvas</h1>
                <p className="mt-4 text-lg text-black">Describe your problem to get started.</p>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-4 relative z-10 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-transparent px-1" style={{ flex: 1, minHeight: 0 }}>
            {chat.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] px-4 py-2 rounded-lg shadow ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-900'}`}>
                  {msg.role === 'assistant' ? (
                    <MarkdownContent content={msg.content} />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full max-w-2xl mx-auto p-6 bg-white">
          {errorMessages.length > 0 && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded error-container">
              <ul className="list-disc pl-5">
                {errorMessages.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          {showPreviewAlert && (
            <div className="mb-2 p-2 bg-red-100 text-red-700 rounded text-center text-sm">Please enter a message or attach a file before previewing.</div>
          )}
          {files.length > 0 && (
            <div className="bg-white rounded-lg p-3 mb-2 border">
              <table className="w-full text-sm">
                {/* <thead>
                  <tr className="border-b">
                    <th className="text-left py-1">Name</th>
                    <th className="text-left py-1">Type</th>
                    <th className="text-left py-1">Size</th>
                    <th className="text-left py-1">Action</th>
                  </tr>
                </thead> */}
                <tbody>
                  {files.map((file, idx) => (
                    <tr key={file.name + file.size} className="border-b last:border-b-0">
                      <td className="py-1 max-w-[180px] truncate" title={file.name} style={{maxWidth: '180px'}}>
                        {file.name.length > 30 ? `${file.name.slice(0, 14)}...${file.name.slice(-12)}` : file.name}
                      </td>
                      <td className="py-1">{file.type === "application/pdf" ? "PDF" : "DOCX"}</td>
                      <td className="py-1">{(file.size / 1024).toFixed(2)} KB</td>
                      <td className="py-1">
                        <button className="text-red-500 text-xs" onClick={() => {
                          setFiles(files.filter((_, i) => i !== idx));
                          // Reset file input so same file can be uploaded again
                          const input = document.getElementById('file-input') as HTMLInputElement;
                          if (input) input.value = "";
                        }}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-start w-full gap-2">
            <div className="flex-1 min-w-0 relative">
              <Textarea
                value={idea}
                onChange={(e) => {
                  if (e.target.value.length <= 1000) setIdea(e.target.value);
                }}
                // maxLength removed to allow unlimited input
                placeholder="Type your message..."
                className="bg-white h-20 w-full pr-24"
                disabled={isLoading}
                // minLength={10}
                // aria-invalid={!!ideaError}
              />
              {/* All three buttons in a row, right-aligned */}
              <div className="absolute top-1/2 right-3 -translate-y-1/2 flex flex-row items-center gap-2 z-10">
                <button
                  className="p-2 bg-white border rounded-full shadow hover:bg-gray-50 transition-colors"
                  onClick={() => document.getElementById('file-input')?.click()}
                  aria-label="Attach file"
                >
                  <svg className="h-6 w-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
                <button
                  className={`p-2 bg-blue-500 rounded-full text-white flex items-center justify-center transition-opacity ${!idea || idea.length < 10 ? 'opacity-50' : 'opacity-100'}`}
                  onClick={handleSubmit}
                  disabled={isLoading || !idea || idea.length < 10}
                  aria-disabled={isLoading || !idea || idea.length < 10}
                >
                  {isLoading ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    "➤"
                  )}
                </button>
                <input
                  id="file-input"
                  type="file"
                  style={{ display: "none" }}
                  accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  multiple={true}
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
              </div>
              {ideaError && (
                <div className="text-red-500 text-xs mt-1">{ideaError}</div>
              )}
              <div className="flex justify-end">
                {/* <div className="text-xs text-gray-400 select-none mt-1 text-right">
                  {idea.length}/1000
                </div> */}
              </div>
            </div>
            {/* Preview button outside the input box */}
            <button
              className="flex-shrink-0 p-3 bg-white border rounded-full shadow hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
              onClick={handlePreview}
              disabled={chat.length === 0}
              aria-disabled={chat.length === 0}
            >
              <img src="/images/preview.png" alt="Preview" className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}