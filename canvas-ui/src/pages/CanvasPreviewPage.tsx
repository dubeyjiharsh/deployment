import React from "react";
import ReactDOM from "react-dom";
import { Download, Save, Edit3 } from "lucide-react"; // Added Edit3 icon
import { Button } from "@/components/ui/button";
import { CanvasGrid } from "@/components/canvas/canvas-grid";
import { navigate } from "@/lib/router";
 
function parseJsonIfString(v: unknown) {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch (e) {
      return v;
    }
  }
  return v;
}
 
function transformFieldsToCanvas(fields: any) {
  const makeField = (value: any) => ({ value: value ?? null, evidence: [], confidence: 0.5 });
 
  const parseArray = (arr: any) => {
    if (!Array.isArray(arr)) return arr ?? [];
    return arr.map((it) => parseJsonIfString(it));
  };
 
  const nfrRaw = fields.non_functional_requirements;
  const nonFunctionalRequirements: any = {};
  if (typeof nfrRaw === "string") {
    nfrRaw.split(/\r?\n/).forEach((line: string) => {
      if (!line.trim()) return;
      try {
        const obj = JSON.parse(line);
        const key = (obj.category || "other").toString();
        nonFunctionalRequirements[key] = nonFunctionalRequirements[key] || [];
        nonFunctionalRequirements[key].push(obj.requirement || obj);
      } catch (e) {
        nonFunctionalRequirements.other = nonFunctionalRequirements.other || [];
        nonFunctionalRequirements.other.push(line);
      }
    });
  } else if (typeof nfrRaw === "object" && nfrRaw !== null) {
    Object.assign(nonFunctionalRequirements, nfrRaw);
  }
 
  const canvas: any = {
    id: fields.canvas_id || fields.canvasId || "",
    title: makeField(fields.title || fields.Title || "Untitled Canvas"),
    problemStatement: makeField(fields.problem_statement || fields.problemStatement || null),
    objectives: makeField(parseArray(fields.objectives || fields.objectives)),
    kpis: makeField(parseArray(fields.kpis || fields.kpis)),
    successCriteria: makeField(parseArray(fields.success_criteria || fields.success_criteria)),
    keyFeatures: makeField(parseArray(fields.key_features || fields.key_features)),
    risks: makeField(parseArray(fields.risks || fields.risks)),
    assumptions: makeField(parseArray(fields.assumptions || fields.assumptions)),
    nonFunctionalRequirements: makeField(nonFunctionalRequirements),
    useCases: makeField(parseArray(fields.use_cases || fields.use_cases)),
    governance: makeField(fields.governance || {}),
    createdAt: fields.created_at || fields.createdAt || new Date().toISOString(),
    updatedAt: fields.updated_at || fields.updatedAt || new Date().toISOString(),
  };
 
  return canvas;
}
 
export function CanvasPreviewPage(): React.ReactElement {
  const canvasId = React.useMemo(() => {
    const hash = window.location.hash;
    const parts = hash.split("/");
    return parts.length >= 3 ? decodeURIComponent(parts[2]) : null;
  }, []);
 
  const [canvas, setCanvas] = React.useState<any | null>(null);
  const [jsonData, setJsonData] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
 
  React.useEffect(() => {
    const id = canvasId || sessionStorage.getItem("canvasId");
    if (!id) {
      setError("No canvas id in URL or session");
      setLoading(false);
      return;
    }
 
    const url = `http://0.0.0.0:8020/api/canvas/${id}/fields`;
    setLoading(true);
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const fields = data?.fields || data;
        setJsonData(fields);
        const transformed = transformFieldsToCanvas(fields);
        setCanvas(transformed);
        sessionStorage.setItem("canvasJson", JSON.stringify(fields));
        sessionStorage.setItem("canvasId", id);
        if (fields.title) sessionStorage.setItem("canvasTitle", fields.title);
      })
      .catch((e) => {
        console.error("Failed to load canvas fields", e);
        setError(String(e));
      })
      .finally(() => setLoading(false));
  }, [canvasId]);
 
  const handleExportJson = (): void => {
    if (!canvas) return;
    const blob = new Blob([JSON.stringify(jsonData || canvas, null, 2)], { type: "application/json" });
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
 
  // Logic to handle navigation back to the Create page with history restoration
  const handleEditCanvas = (e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
 
    const id = canvas?.id || sessionStorage.getItem("canvasId");
    if (!id) return;
 
    // Set session storage to signal CreateCanvasPage to restore history
    sessionStorage.setItem("canvasId", id);
    sessionStorage.setItem("isEditingCanvas", "true");
    sessionStorage.removeItem("chatState"); // Ensure fresh history fetch
    
    navigate(`/canvas/create`);
  };
 
  if (loading) return <div className="p-6">Loading preview...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;
  if (!canvas) return <div className="p-6">No canvas data available.</div>;
 
  return (
    <>
      {ReactDOM.createPortal(
        <div className="flex items-center gap-3">
          <h1 className="text-base font-medium truncate max-w-[300px]">{canvas.title?.value || "Untitled Canvas"}</h1>
        </div>,
        document.getElementById("page-header")!
      )}
 
      {ReactDOM.createPortal(
        <div className="flex items-center gap-3">
          
          {/* New Edit Canvas Button Added Below */}
          <Button variant="outline" size="sm" onClick={handleEditCanvas}>
            <Edit3 className="mr-2 h-4 w-4" />
            AI Refine
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportJson}>
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
        </div>,
        document.getElementById("page-actions")!
      )}
 
      <div className="p-6">
        <CanvasGrid canvas={canvas} onCanvasChange={setCanvas} />
      </div>
    </>
  );
}
 