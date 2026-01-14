import React from "react";
import ReactDOM from "react-dom";
import { Download, Save, Edit3 } from "lucide-react"; // Added Edit3 icon
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { CanvasGrid } from "@/components/canvas/canvas-grid";
import { navigate } from "@/lib/router";
import { API_ENDPOINTS } from '@/config/api';
import { toast } from "sonner";


// Converts the frontend canvas object to the backend payload format (handles NFR and Governance/Relevant Facts)
function mapCanvasToBackendPayload(canvas: any) {
  // Convert the categorized NFR object back into the flat array the backend expects
  const nfrRaw = canvas.nonFunctionalRequirements?.value || {};
  const formattedNFRs = Object.entries(nfrRaw).flatMap(([category, requirements]) => {
    if (Array.isArray(requirements)) {
      return requirements.map(req => ({
        category: category,
        requirement: typeof req === 'string' ? req : JSON.stringify(req)
      }));
    }
    return [];
  });
 
  return {
    "Title": canvas.title?.value || "",
    "Problem Statement": canvas.problemStatement?.value || "",
    "Objectives": Array.isArray(canvas.objectives?.value) ? canvas.objectives.value : [],
    "KPIs": Array.isArray(canvas.kpis?.value) ? canvas.kpis.value : [],
    "Success Criteria": Array.isArray(canvas.successCriteria?.value) ? canvas.successCriteria.value : [],
    "Key Features": Array.isArray(canvas.keyFeatures?.value) ? canvas.keyFeatures.value : [],
    "Risks": Array.isArray(canvas.risks?.value) ? canvas.risks.value : [],
    "Assumptions": Array.isArray(canvas.assumptions?.value) ? canvas.assumptions.value : [],
    // FIX: Send as Array of Objects
    "Non Functional Requirements": Array.isArray(canvas.nonFunctionalRequirements?.value) ? canvas.nonFunctionalRequirements.value : [],
    // Governance: send as dictionary (object) with string keys and any values
    "Governance": typeof canvas.governance?.value === 'object' && canvas.governance?.value !== null
      ? canvas.governance.value
      : {},
    "Relevant Facts": Array.isArray(canvas.relevantFacts?.value) ? canvas.relevantFacts.value : [],
    "Use Cases": Array.isArray(canvas.useCases?.value) ? canvas.useCases.value : [],
  };
}

 
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
 
  const nfrRaw = fields["Non Functional Requirements"] || fields.non_functional_requirements || [];
  const organizedNFRs: any = {};
  if (Array.isArray(nfrRaw)) {
    nfrRaw.forEach((item: any) => {
      const cat = item.category || "General";
      const req = item.requirement || "";
      if (!organizedNFRs[cat]) organizedNFRs[cat] = [];
      organizedNFRs[cat].push(req);
    });
  }
 
  // Always parse 'Relevant Facts' as an array of strings (like Assumptions)
  let relevantFactsRaw = fields.RelevantFacts || fields.relevantFacts || [];
  let relevantFactsArr: string[] = Array.isArray(relevantFactsRaw)
    ? relevantFactsRaw.filter((v) => typeof v === 'string')
    : [];
  return {
    id: fields.canvas_id || fields.canvasId || "",
    title: makeField(fields.Title || fields.title || "Untitled Canvas"),
    problemStatement: makeField(fields.problem_statement || fields.problemStatement || fields["Problem Statement"]),
    objectives: makeField(parseArray(fields.Objectives || fields.objectives)),
    kpis: makeField(parseArray(fields.KPIs || fields.kpis)),
    successCriteria: makeField(parseArray(fields["Success Criteria"] || fields.success_criteria)),
    keyFeatures: makeField(parseArray(fields["Key Features"] || fields.key_features)),
    risks: makeField(parseArray(fields.Risks || fields.risks)),
    assumptions: makeField(parseArray(fields.Assumptions || fields.assumptions)),
    nonFunctionalRequirements: makeField(parseArray(fields["Non Functional Requirements"] || fields.non_functional_requirements)),
    useCases: makeField(parseArray(fields["Use Cases"] || fields.use_cases)),
    governance: makeField(fields.Governance || fields.governance || {}),
    relevantFacts: makeField(parseArray(fields.RelevantFacts || fields.relevantFacts)),
    createdAt: fields.created_at || fields.createdAt || new Date().toISOString(),
    updatedAt: fields.updated_at || fields.updatedAt || new Date().toISOString(),
  };
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
 
    const fetchCanvasFields = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.canvasFields(id), {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem("authToken") || ""}`,
          },
        });
        const data = await response.json();
        const fields = data?.fields || data;
        setJsonData(fields);
        const transformed = transformFieldsToCanvas(fields);
        setCanvas(transformed);
        sessionStorage.setItem("canvasJson", JSON.stringify(fields));
        sessionStorage.setItem("canvasId", id);
        if (fields.title) sessionStorage.setItem("canvasTitle", fields.title);
      } catch (error) {
        console.error("Failed to fetch canvas fields:", error);
        setError(String(error));
      } finally {
        setLoading(false);
      }
    };

    fetchCanvasFields();
  }, [canvasId]);

  const handleSave = async (): Promise<void> => {
    if (!canvas) return;
    const id = canvas.id || sessionStorage.getItem("canvasId");
    if (!id) return;
    const url = API_ENDPOINTS.canvasSave(id);
    const payload = mapCanvasToBackendPayload(canvas);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setJsonData(data.fields || data);
      setCanvas(transformFieldsToCanvas(data.fields || data));
      toast.success("Canvas saved successfully!");
      window.location.reload(); // Reload the page to reflect updates
    } catch (error) {
      toast.error("Failed to save canvas");
      console.error("Failed to save canvas:", error);
    }
  };


  
 
  const handleExportWord = async (): Promise<void> => {
    if (!canvasId) return;
    const url = API_ENDPOINTS.canvasDownload(canvasId, "docx");
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) return;
    const blob = await response.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(canvas?.title?.value || "canvas").toString().slice(0, 80)}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
 
  const handleExportPdf = async (): Promise<void> => {
    if (!canvasId) return;
    const url = API_ENDPOINTS.canvasDownload(canvasId, "pdf");
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) return;
    const blob = await response.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(canvas?.title?.value || "canvas").toString().slice(0, 80)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportWord}>Download as Word</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPdf}>Download as PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>,
        document.getElementById("page-actions")!
      )}
 
      <div className="p-6">
        <CanvasGrid canvas={canvas} onCanvasChange={setCanvas} />
      </div>
    </>
  );
}

