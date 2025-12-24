// import React from "react";

// export function CanvasPreviewPage(): React.ReactElement {
//   // Retrieve the latest canvas data from sessionStorage
//   const canvasData = React.useMemo(() => {
//     const data = sessionStorage.getItem("canvasData");
//     return data ? JSON.parse(data) : null;
//   }, []);

//   // Store title in sessionStorage for sidebar
//   React.useEffect(() => {
//     if (canvasData && canvasData.bmc_result?.Title) {
//       sessionStorage.setItem("canvasTitle", canvasData.bmc_result.Title);
//     }
//   }, [canvasData]);

//   const canvasId = window.location.hash.split("/")[2];

//   console.log("Canvas ID from hash path:", canvasId);
//   console.log("Full URL:", window.location.href);
//   console.log("Search Params:", new URLSearchParams(window.location.search).toString());

//   React.useEffect(() => {
//     if (canvasId) {
//       fetch(`http://0.0.0.0:8020/api/canvas/${canvasId}`)
//         .then((response) => {
//           console.log("Backend response status:", response.status);
//           return response.json();
//         })
//         .then((data) => {
//           console.log("Fetched canvas data:", data);
//           sessionStorage.setItem("canvasData", JSON.stringify(data));
//         })
//         .catch((error) => {
//           console.error("Error fetching canvas data:", error);
//         });
//     }
//   }, [canvasId]);

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-white">
//       <div className="p-8 max-w-2xl w-full bg-gray-50 rounded-lg shadow-lg">
//         <h2 className="text-3xl font-bold text-blue-600 mb-4">Canvas Preview</h2>
//         {canvasData ? (
//           <pre className="whitespace-pre-wrap text-sm text-gray-800 bg-white p-4 rounded border overflow-x-auto">
//             {JSON.stringify(canvasData, null, 2)}
//           </pre>
//         ) : (
//           <div className="text-gray-500">No canvas data found. Please generate a canvas first.</div>
//         )}
//       </div>
//     </div>
//   );
// }


// import React from "react";

// export function CanvasPreviewPage(): React.ReactElement {
//   // Extract canvas ID from URL hash (e.g., #/canvas-preview/canvas_123)
//   const canvasId = React.useMemo(() => {
//     const hash = window.location.hash;
//     const parts = hash.split("/");
//     // parts will be ["#", "canvas-preview", "canvas_123"]
//     return parts.length >= 3 ? decodeURIComponent(parts[2]) : null;
//   }, []);

//   // Retrieve canvas data from sessionStorage
//   const [canvasData, setCanvasData] = React.useState<any>(() => {
//     const data = sessionStorage.getItem("canvasJson");
//     return data ? JSON.parse(data) : null;
//   });

//   // Store title in sessionStorage for sidebar
//   React.useEffect(() => {
//     if (canvasData && canvasData.Title) {
//       sessionStorage.setItem("canvasTitle", canvasData.Title);
//     }
//   }, [canvasData]);

//   // Fetch canvas data from backend if canvas ID is available
//   React.useEffect(() => {
//     const id = canvasId || sessionStorage.getItem("canvasId");
    
//     if (id) {
//       console.log("Fetching canvas data for ID:", id);
//       fetch(`http://0.0.0.0:8020/api/canvas/${id}`)
//         .then((response) => {
//           console.log("Backend response status:", response.status);
//           if (!response.ok) {
//             throw new Error(`HTTP error! status: ${response.status}`);
//           }
//           return response.json();
//         })
//         .then((data) => {
//           console.log("Fetched canvas data:", data);
//           // Store in sessionStorage and update state
//           sessionStorage.setItem("canvasJson", JSON.stringify(data));
//           setCanvasData(data);
//         })
//         .catch((error) => {
//           console.error("Error fetching canvas data:", error);
//         });
//     } else {
//       console.log("No canvas ID available, using sessionStorage data only");
//     }
//   }, [canvasId]);

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-white">
//       <div className="p-8 max-w-2xl w-full bg-gray-50 rounded-lg shadow-lg">
//         <h2 className="text-3xl font-bold text-blue-600 mb-4">Canvas Preview</h2>
//         {canvasData ? (
//           <pre className="whitespace-pre-wrap text-sm text-gray-800 bg-white p-4 rounded border overflow-x-auto">
//             {JSON.stringify(canvasData, null, 2)}
//           </pre>
//         ) : (
//           <div className="text-gray-500">No canvas data found. Please generate a canvas first.</div>
//         )}
//       </div>
//     </div>
//   );
// }


import React from "react";

export function CanvasPreviewPage(): React.ReactElement {
  // Extract canvas ID from URL hash (e.g., #/canvas-preview/canvas_123)
  const canvasId = React.useMemo(() => {
    const hash = window.location.hash;
    const parts = hash.split("/");
    // parts will be ["#", "canvas-preview", "canvas_123"]
    return parts.length >= 3 ? decodeURIComponent(parts[2]) : null;
  }, []);

  // Retrieve canvas data from sessionStorage
  const [canvasData, setCanvasData] = React.useState<any>(() => {
    const data = sessionStorage.getItem("canvasJson");
    return data ? JSON.parse(data) : null;
  });

  // Store title in sessionStorage for sidebar
  React.useEffect(() => {
    if (canvasData && canvasData.Title) {
      sessionStorage.setItem("canvasTitle", canvasData.Title);
    }
  }, [canvasData]);

  // Fetch canvas data from backend if canvas ID is available
  React.useEffect(() => {
    const id = canvasId || sessionStorage.getItem("canvasId");
    
    if (id) {
      console.log("Fetching canvas data for ID:", id);
      fetch(`http://0.0.0.0:8020/api/canvas/${id}`)
        .then((response) => {
          console.log("Backend response status:", response.status);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          console.log("Fetched canvas data:", data);
          // Store in sessionStorage and update state
          sessionStorage.setItem("canvasJson", JSON.stringify(data));
          setCanvasData(data);
        })
        .catch((error) => {
          console.error("Error fetching canvas data:", error);
        });
    } else {
      console.log("No canvas ID available, using sessionStorage data only");
    }
  }, [canvasId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="p-8 max-w-4xl w-full bg-gray-50 rounded-lg shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-blue-600">Canvas Preview</h2>
          <button
            onClick={() => {
              // Navigate back to create canvas page
              window.location.hash = '/canvas/create';
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Chat
          </button>
        </div>
        {canvasData ? (
          <pre className="whitespace-pre-wrap text-sm text-gray-800 bg-white p-4 rounded border overflow-x-auto max-h-[70vh]">
            {JSON.stringify(canvasData, null, 2)}
          </pre>
        ) : (
          <div className="text-gray-500">No canvas data found. Please generate a canvas first.</div>
        )}
      </div>
    </div>
  );
}