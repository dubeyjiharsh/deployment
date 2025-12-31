import * as React from "react";
import ReactDOM from "react-dom";
import { Download, Save } from "lucide-react";
import { useSearchParams } from "react-router-dom";
 
import { Button } from "@/components/ui/button";
import { CanvasGrid } from "@/components/canvas/canvas-grid";
import { DEMO_CANVAS_ID, getDemoCanvas } from "@/lib/demo-canvas";
import { navigate, useHashPath } from "@/lib/router";
import type { BusinessCanvas } from "@/lib/validators/canvas-schema";
 
export function CanvasPage(): React.ReactElement {
  const path = useHashPath();
  const canvasId = path.split("/")[2] || DEMO_CANVAS_ID;
  const [searchParams] = useSearchParams();
 
  const [canvas, setCanvas] = React.useState<BusinessCanvas | null>(null);
  const [jsonData, setJsonData] = React.useState<object | null>(null);
  const [error, setError] = React.useState<string | null>(null);
 
  React.useEffect(() => {
    const data = searchParams.get("data");
    if (data) {
      try {
        const parsedData = JSON.parse(decodeURIComponent(data));
        setCanvas(parsedData);
        setJsonData(parsedData);
      } catch (err) {
        console.error("Failed to parse JSON data:", err);
        setError("Invalid JSON format. Unable to display data.");
      }
    } else {
      setError("No data provided in the URL.");
    }
  }, [searchParams]);
 
  // Only redirect with replace if the canvasId is invalid (not found in your data)
  // Otherwise, do not interfere with browser history
  // Remove or adjust this logic as needed for your app's requirements
 
  const handleExportJson = (): void => {
    if (!canvas) return;
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
      // Reload canvas state from localStorage to update UI immediately
      const saved = localStorage.getItem("savedCanvas");
      if (saved) {
        const parsed = JSON.parse(saved);
        setCanvas(parsed);
        setJsonData(parsed);
      }
    } catch (error) {
      console.error("Failed to save canvas:", error);
    }
  };
 
  if (error) {
    return <div className="p-6 text-red-500">{error}</div>;
  }
 
  if (!canvas) {
    return <div className="p-6">Loading...</div>;
  }
 
  return (
    <>
      {ReactDOM.createPortal(
        <div className="flex items-center gap-3">
          <h1 className="text-base font-medium truncate max-w-[300px]">
            {canvas.title?.value || "Untitled Canvas"}
          </h1>
        </div>,
        document.getElementById("page-header")!
      )}
 
      {ReactDOM.createPortal(
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
        document.getElementById("page-actions")!
      )}
 
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">{canvas.title?.value || "Untitled Canvas"}</h1>
        <p className="mb-4">{canvas.problemStatement?.value || "No problem statement provided."}</p>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Objectives</h2>
          <ul className="list-disc pl-6">
            {Array.isArray(canvas.objectives?.value)
              ? canvas.objectives.value
                  .filter((objective): objective is string => typeof objective === "string")
                  .map((objective, index) => (
                    <li key={index}>{objective}</li>
                  ))
              : null}
          </ul>
 
          <h2 className="text-xl font-semibold">Key Features</h2>
          <ul className="list-disc pl-6">
            {canvas.keyFeatures?.value?.map((feature: any, index: number) => (
              <li key={index}>
                <strong>{feature.feature}:</strong> {feature.description}
              </li>
            ))}
          </ul>
 
          <h2 className="text-xl font-semibold">Risks</h2>
          <ul className="list-disc pl-6">
            {Array.isArray(canvas.risks?.value)
              ? canvas.risks.value.map((risk: any, index: number) =>
                  typeof risk === "string" ? (
                    <li key={index}>{risk}</li>
                  ) : (
                    <li key={index}>
                      <strong>{risk.risk}:</strong> {risk.mitigation}
                    </li>
                  )
                )
              : null}
          </ul>
 
          <h2 className="text-xl font-semibold">Non Functional Requirements</h2>
          <ul className="list-disc pl-6">
            {(Array.isArray(canvas.nonFunctionalRequirements && (canvas.nonFunctionalRequirements as any).value)
              ? (canvas.nonFunctionalRequirements as any).value
              : [])
              .map((nfr: any, index: number) =>
                typeof nfr === "string" ? (
                  <li key={index}>{nfr}</li>
                ) : (
                  <li key={index}>
                    <strong>{nfr.category ? `${nfr.category}: ` : ""}</strong>
                    {nfr.requirement}
                    {nfr.rationale ? <span> <em>({nfr.rationale})</em></span> : null}
                  </li>
                )
              )}
          </ul>
        </div>
      </div>
 
      <div className="p-6">
        <CanvasGrid canvas={canvas} onCanvasChange={setCanvas} />
      </div>
 
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Output JSON Data</h1>
        <pre className="bg-gray-100 p-4 rounded-md overflow-auto text-sm">
          {JSON.stringify(jsonData, null, 2)}
        </pre>
      </div>
    </>
  );
}
 
 