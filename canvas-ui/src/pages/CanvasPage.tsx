import * as React from "react";
import ReactDOM from "react-dom";
import { Download, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CanvasGrid } from "@/components/canvas/canvas-grid";
import { DEMO_CANVAS_ID, getDemoCanvas } from "@/lib/demo-canvas";
import { navigate, useHashPath } from "@/lib/router";
import type { BusinessCanvas } from "@/lib/validators/canvas-schema";

export function CanvasPage(): React.ReactElement {
  const path = useHashPath();
  const canvasId = path.split("/")[2] || DEMO_CANVAS_ID;

  const [canvas, setCanvas] = React.useState<BusinessCanvas>(() => getDemoCanvas(DEMO_CANVAS_ID));
  const [headerPortal, setHeaderPortal] = React.useState<HTMLElement | null>(null);
  const [actionsPortal, setActionsPortal] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    setHeaderPortal(document.getElementById("page-header"));
    setActionsPortal(document.getElementById("page-actions"));
  }, []);

  React.useEffect(() => {
    if (canvasId !== DEMO_CANVAS_ID) {
      navigate(`/canvas/${DEMO_CANVAS_ID}`, { replace: true });
      return;
    }
    setCanvas(getDemoCanvas(DEMO_CANVAS_ID));
  }, [canvasId]);

  const handleExportJson = (): void => {
    const blob = new Blob([JSON.stringify(canvas, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(canvas.title?.value || "canvas").toString().slice(0, 80)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleSave = (): void => {
    try {
      localStorage.setItem("savedCanvas", JSON.stringify(canvas));
      console.log("Canvas saved successfully!");
    } catch (error) {
      console.error("Failed to save canvas:", error);
    }
  };

  React.useEffect(() => {
    const savedCanvas = localStorage.getItem("savedCanvas");
    if (savedCanvas) {
      try {
        setCanvas(JSON.parse(savedCanvas));
      } catch (error) {
        console.error("Failed to load saved canvas:", error);
      }
    }
  }, []);

  return (
    <>
      {headerPortal &&
        ReactDOM.createPortal(
          <div className="flex items-center gap-3">
            <h1 className="text-base font-medium truncate max-w-[300px]">
              {canvas.title?.value || "Untitled Canvas"}
            </h1>
            {/* <Button variant="outline" size="sm" onClick={handleSave} className="ml-3">
              <Save className="mr-2" />
              Save
            </Button> */}
          </div>,
          headerPortal
        )}

      {actionsPortal &&
        ReactDOM.createPortal(
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleSave}>
              <Save className="mr-2" />
              Save
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportJson}>
              <Download className="mr-2" />
              Export JSON
            </Button>
          </div>,
          actionsPortal
        )}

      <div className="p-6">
        <CanvasGrid canvas={canvas} onCanvasChange={setCanvas} />
      </div>
    </>
  );
}
