// // main.tsx
// import * as React from "react";
// import { createRoot } from "react-dom/client";
// import { App } from "@/src/App";
// import "@/src/globals.css";
// import { initKeycloak } from "@/src/lib/auth"; //

// const root = createRoot(document.getElementById("root")!);

// // Ensure Keycloak is initialized before rendering the UI
// initKeycloak(() => {
//   root.render(
//     <React.StrictMode>
//       <App />
//     </React.StrictMode>
//   );
// });

// main.tsx
import * as React from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/src/App";
import "@/src/globals.css";
import { initKeycloak } from "@/src/lib/auth";
import { HashRouter } from "react-router-dom";

const root = createRoot(document.getElementById("root")!);

// Show initial loading state
root.render(
  <div className="flex items-center justify-center h-screen">
    <div className="text-center">
      <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-lg animate-pulse">Initializing...</p>
    </div>
  </div>
);

// Ensure Keycloak is initialized before rendering the UI
initKeycloak(() => {
  console.log("Keycloak initialization complete, rendering App");
  root.render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>
  );
});