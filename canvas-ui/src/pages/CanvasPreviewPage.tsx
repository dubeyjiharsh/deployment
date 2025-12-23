import React from "react";

export function CanvasPreviewPage(): React.ReactElement {
  // Retrieve the latest canvas data from sessionStorage
  const canvasData = React.useMemo(() => {
    const data = sessionStorage.getItem("canvasData");
    return data ? JSON.parse(data) : null;
  }, []);

  // Store title in sessionStorage for sidebar
  React.useEffect(() => {
    if (canvasData && canvasData.bmc_result?.Title) {
      sessionStorage.setItem("canvasTitle", canvasData.bmc_result.Title);
    }
  }, [canvasData]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="p-8 max-w-2xl w-full bg-gray-50 rounded-lg shadow-lg">
        <h2 className="text-3xl font-bold text-blue-600 mb-4">Canvas Preview</h2>
        {canvasData ? (
          <pre className="whitespace-pre-wrap text-sm text-gray-800 bg-white p-4 rounded border overflow-x-auto">
            {JSON.stringify(canvasData, null, 2)}
          </pre>
        ) : (
          <div className="text-gray-500">No canvas data found. Please generate a canvas first.</div>
        )}
      </div>
    </div>
  );
}
