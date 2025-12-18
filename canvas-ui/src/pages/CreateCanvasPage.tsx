"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DEMO_CANVAS_ID } from "@/lib/demo-canvas";
import { linkTo } from "@/lib/router";

export function CreateCanvasPage(): React.ReactElement {
  const [idea, setIdea] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const handleFileUpload = (files: FileList | null) => {
    if (files) {
      console.log("Uploaded files:", files);
    }
  };

  return (
    <div className="p-6 flex flex-col justify-between min-h-screen">
      <div className="max-w-3xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Create Canvas</h1>
          <p className="text-sm text-muted-foreground">Static demo mode: this doesn’t create anything yet.</p>
        </div>
      </div>

      <Card className="border mb-6 self-center w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">Problem / Idea</CardTitle>
          <CardDescription>Type anything — it won’t be saved in demo mode.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Describe your initiative..."
            className="min-h-[140px]"
          />
          <div className="flex items-center justify-between gap-3">
            <Button disabled aria-disabled>
              Create (disabled)
            </Button>
            <Button asChild variant="outline">
              <a href={linkTo(`/canvas/${DEMO_CANVAS_ID}`)}>Open demo canvas</a>
            </Button>
            <Button variant="default" onClick={() => setIsDialogOpen(true)}>
              Upload File
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700">
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
    </div>
  );
}
