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

  const handleFileUpload = (files: FileList | null) => {
    if (files && files.length > 0) {
      setFile(files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!idea || !file) {
      alert("Please provide a problem statement and upload a file.");
      return;
    }

    const formData = new FormData();
    formData.append("problem_statement", idea);
    formData.append("file", file);

    setIsLoading(true);

    try {
      console.log("Sending data to backend...");
      const response = await axios.post(
        "http://0.0.0.0:8021/generate_bmc_instant",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const result = response.data;
      console.log("Backend response:", result);

      // Store the result in sessionStorage
      sessionStorage.setItem("canvasData", JSON.stringify(result));

      // Navigate to the results page using hash routing
      window.location.hash = "/canvas/result";
      
    } catch (error) {
      console.error("Error submitting data:", error);
      alert("Failed to generate the business canvas. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="p-6 flex flex-col justify-between w-full max-w-3xl">
        <div className="max-w-3xl space-y-4">
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
          
          <div className="flex items-center">
            <div className="relative w-full">
              <Textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="Describe your problem or opportunity"
                className="flex-grow bg-white bg-opacity-20 placeholder:text-black pr-28 h-20 w-full"
                disabled={isLoading}
              />
              <div className="absolute inset-y-0 right-0 flex items-center space-x-2 pr-2">
                <button
                  className="p-2 bg-white border rounded-full shadow disabled:opacity-50 hover:bg-gray-50 transition-colors"
                  onClick={() => document.getElementById("file-input")?.click()}
                  disabled={isLoading}
                  title="Attach file"
                >
                  <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
                <button
                  className="p-2 bg-blue-500 border border-blue-500 rounded-full shadow disabled:opacity-50 hover:bg-blue-600 transition-colors"
                  onClick={handleSubmit}
                  disabled={isLoading || !idea || !file}
                  title="Generate canvas"
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
          </div>
          
          {isLoading && (
            <div className="text-center text-sm text-gray-600">
              Generating your business canvas... This may take a moment.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
