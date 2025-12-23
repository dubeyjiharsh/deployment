import * as React from "react";
import ReactDOM from "react-dom";
import { Download, Save, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CanvasGrid } from "@/components/canvas/canvas-grid";
import { navigate } from "@/lib/router";
import type { BusinessCanvas } from "@/lib/validators/canvas-schema";

export function CanvasResultPage(): React.ReactElement {
  const [canvas, setCanvas] = React.useState<BusinessCanvas | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Retrieve data from sessionStorage
    const storedData = sessionStorage.getItem("canvasData");
    
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData);
        setCanvas(parsedData);
      } catch (err) {
        console.error("Failed to parse stored data:", err);
        setError("Invalid data format. Unable to display canvas.");
      }
    } else {
      setError("No canvas data found. Please create a new canvas.");
    }
  }, []);

  const handleExportJson = (): void => {
    if (!canvas) return;
    
    const blob = new Blob([JSON.stringify(canvas, null, 2)], { 
      type: "application/json" 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(canvas.bmc_result?.Title || "canvas")
      .toString()
      .slice(0, 80)
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleSave = (): void => {
    try {
      const savedCanvases = JSON.parse(
        localStorage.getItem("savedCanvases") || "[]"
      );
      
      const newCanvas = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        data: canvas,
      };
      
      savedCanvases.push(newCanvas);
      localStorage.setItem("savedCanvases", JSON.stringify(savedCanvases));
      
      alert("Canvas saved successfully!");
    } catch (error) {
      console.error("Failed to save canvas:", error);
      alert("Failed to save canvas. Please try again.");
    }
  };

  const handleBack = (): void => {
    navigate("/canvas/create");
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-500 text-lg">{error}</p>
          <Button
            onClick={async () => {
              try {
                await fetch("http://0.0.0.0:8020/api/canvas/create", { method: "POST" });
              } catch (err) {
                console.error("Failed to call canvas create API", err);
              }
              handleBack();
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Create New Canvas
          </Button>
        </div>
      </div>
    );
  }

  if (!canvas) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading canvas...</div>
      </div>
    );
  }

  return (
    <>
      {ReactDOM.createPortal(
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-base font-medium truncate max-w-[300px]">
            {canvas.bmc_result?.Title || "Untitled Canvas"}
          </h1>
        </div>,
        document.getElementById("page-header")!
      )}

      {ReactDOM.createPortal(
        <div className="flex items-center gap-3">
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

      <div className="p-6 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">
            {canvas.bmc_result?.Title || "Untitled Canvas"}
          </h1>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <h3 className="font-semibold text-blue-900 mb-2">Problem Statement</h3>
            <p className="text-gray-700">
              {canvas.bmc_result?.["Problem Statement"] || 
               canvas.bmc_result?.Problem_Statement || 
               "No problem statement provided."}
            </p>
          </div>
        </div>

        {/* Objectives Section */}
        {canvas.bmc_result?.Objectives && canvas.bmc_result.Objectives.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Objectives</h2>
            <ul className="space-y-2">
              {canvas.bmc_result.Objectives.map((objective, index) => (
                <li key={index} className="flex items-start">
                  <span className="inline-block w-6 h-6 bg-blue-500 text-white rounded-full text-center mr-3 flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-gray-700 pt-0.5">{objective}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* KPIs Section */}
        {canvas.bmc_result?.KPIs && canvas.bmc_result.KPIs.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Key Performance Indicators</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {canvas.bmc_result.KPIs.map((kpi, index) => (
                <div key={index} className="bg-white border rounded-lg p-4 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-2">{kpi.metric}</h3>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-600">
                      <span className="font-medium">Target:</span> {kpi.target}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-medium">Frequency:</span> {kpi.measurement_frequency}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key Features Section */}
        {canvas.bmc_result?.["Key Features"] && canvas.bmc_result["Key Features"].length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Key Features</h2>
            <div className="space-y-3">
              {canvas.bmc_result["Key Features"].map((feature, index) => (
                <div key={index} className="bg-white border rounded-lg p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-grow">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {feature.feature}
                      </h3>
                      <p className="text-gray-600 text-sm">{feature.description}</p>
                    </div>
                    <span className={`ml-4 px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                      feature.priority === "High" 
                        ? "bg-red-100 text-red-800"
                        : feature.priority === "Medium"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-green-100 text-green-800"
                    }`}>
                      {feature.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risks Section */}
        {canvas.bmc_result?.Risks && canvas.bmc_result.Risks.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Risks & Mitigation</h2>
            <div className="space-y-3">
              {canvas.bmc_result.Risks.map((risk, index) => (
                <div key={index} className="bg-white border rounded-lg p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{risk.risk}</h3>
                    <div className="flex gap-2 ml-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        risk.impact === "High"
                          ? "bg-red-100 text-red-800"
                          : risk.impact === "Medium"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-800"
                      }`}>
                        Impact: {risk.impact}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        risk.probability === "High"
                          ? "bg-red-100 text-red-800"
                          : risk.probability === "Medium"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-800"
                      }`}>
                        Probability: {risk.probability}
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm">
                    <span className="font-medium">Mitigation:</span> {risk.mitigation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Canvas Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Business Model Canvas</h2>
          <CanvasGrid canvas={canvas} onCanvasChange={setCanvas} />
        </div>

        {/* JSON Data Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Raw JSON Data</h2>
          <pre className="bg-gray-50 border rounded-lg p-4 overflow-auto text-xs">
            {JSON.stringify(canvas, null, 2)}
          </pre>
        </div>
      </div>
    </>
  );
}