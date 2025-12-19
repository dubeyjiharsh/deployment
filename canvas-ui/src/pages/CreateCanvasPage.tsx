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
import { DEMO_CANVAS_ID } from "@/lib/demo-canvas";
import { linkTo } from "@/lib/router";
import { Textarea } from "@/components/ui/textarea";

export function CreateCanvasPage(): React.ReactElement {
  const [idea, setIdea] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const handleFileUpload = (files: FileList | null) => {
    if (files) {
      console.log("Uploaded files:", files);
    }
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
          <div className="flex items-center">
            <div className="relative w-full">
              <Textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="Describe your problem or opportunity"
                className="flex-grow bg-white bg-opacity-20 placeholder:text-black pr-28 h-20 w-full"
              />
              <div className="absolute inset-y-0 right-0 flex items-center space-x-2 pr-2">
                <button
                  className="p-2 bg-white border rounded-full shadow"
                  onClick={() => document.getElementById("file-input")?.click()}
                >
                  <img
                    src="/public/images/attach-icon.jpg"
                    alt="Attach"
                    className="h-6 w-6 object-contain"
                  />
                </button>
                <button
                  className="p-2 bg-white border rounded-full shadow"
                  onClick={() => (window.location.href = "/canvas/demo#/canvas/demo")}
                >
                  <img
                    src="/public/images/send-icon.jpg"
                    alt="Send"
                    className="h-6 w-6 object-contain"
                  />
                </button>
              </div>
              <input
                id="file-input"
                type="file"
                accept=".pdf,.doc,.docx"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    console.log("Attached file:", e.target.files[0]);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
