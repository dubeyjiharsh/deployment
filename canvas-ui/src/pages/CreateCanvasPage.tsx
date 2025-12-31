"use client";
 
import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import axios from "axios";
import { navigate } from "@/lib/router";
import { API_ENDPOINTS } from '@/config/api';
 
export function CreateCanvasPage(): React.ReactElement {
  const [idea, setIdea] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [chat, setChat] = React.useState<Array<{role: string, content: string}>>([]);
  const [canvasId, setCanvasId] = React.useState<string | null>(null);
 
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
              content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
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
 
  const handleFileUpload = (files: FileList | null) => {
    if (files && files.length > 0) setFile(files[0]);
  };
 
  const handleSubmit = async () => {
    if (!idea || !canvasId) return;
    const userMsg = { role: "user", content: idea };
    setChat((prev) => [...prev, userMsg]);
    setIsLoading(true);
 
    try {
      const formData = new FormData();
      formData.append("message", idea);
      if (file) formData.append("files", file);
 
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
 
      const history = response.data.conversation_history;
      if (Array.isArray(history)) {
        const mapped = history.map((m: any) => ({
          role: m.role || "assistant",
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        }));
        setChat(mapped);
        sessionStorage.setItem("chatState", JSON.stringify(mapped));
      }
      if (response.data?.canvas_json) {
        sessionStorage.setItem("canvasJson", JSON.stringify(response.data.canvas_json));
      }
      setFile(null);
    } catch (error) {
      console.error("Submit error:", error);
    } finally {
      setIsLoading(false);
      setIdea("");
    }
  };
 
  const handlePreview = () => {
    if (!canvasId) return;
    sessionStorage.setItem("chatState", JSON.stringify(chat));
    navigate(`/canvas-preview/${encodeURIComponent(canvasId)}`);
  };
 
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
          <div className="flex flex-col gap-4 relative z-10 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent px-1" style={{ flex: 1, minHeight: 0 }}>
            {chat.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] px-4 py-2 rounded-lg shadow ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-900'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full max-w-2xl mx-auto p-6 bg-white">
          {file && (
             <div className="bg-white rounded-lg p-3 mb-2 flex justify-between items-center border">
               <span className="text-sm font-medium">{file.name}</span>
               <button onClick={() => setFile(null)} className="text-red-500">✕</button>
             </div>
          )}
          <div className="flex items-center w-full gap-2">
            <div className="relative flex-grow">
              <Textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="Type your message..."
                className="bg-white h-20 w-full pr-28"
                disabled={isLoading}
              />
              <div className="absolute inset-y-0 right-0 flex items-center space-x-2 pr-2">
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
                  className="p-2 bg-blue-500 rounded-full text-white flex items-center justify-center"
                  onClick={handleSubmit}
                  disabled={isLoading || !idea}
                >
                  {isLoading ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    "➤"
                  )}
                </button>
              </div>
              <input
                id="file-input" type="file" style={{ display: "none" }}
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </div>
            <button className="p-2 bg-white border rounded-full shadow hover:bg-gray-50" onClick={handlePreview}>
               <img src="/dist/images/preview.png" alt="Preview" className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}