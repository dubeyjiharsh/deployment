// import * as React from "react";

// import { ThemeProvider } from "@/components/theme-provider";
// import { Toaster } from "@/components/ui/sonner";
// import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
// import { AppSidebar } from "@/components/app-sidebar";
// import { SiteHeader } from "@/components/site-header";
// import { useHashPath } from "@/lib/router";

// import { DashboardPage } from "@/src/pages/DashboardPage";
// import { CreateCanvasPage } from "@/src/pages/CreateCanvasPage";
// import { CanvasPage } from "@/src/pages/CanvasPage";
// import { UserManagementPage } from "@/src/pages/UserManagementPage";
// import { NotFoundPage } from "@/src/pages/NotFoundPage";
// import { CanvasResultPage } from "./pages/CanvasResultPage";

// export function App(): React.ReactElement {
//   const path = useHashPath();

//   let content: React.ReactNode = <NotFoundPage />;
//   if (path === "/" || path === "") content = <DashboardPage />;
//   else if (path === "/canvas/create") content = <CreateCanvasPage />;
//   else if (path.startsWith("/canvas/")) content = <CanvasPage />;
//   else if (path === "/admin") content = <UserManagementPage />;

//   return (
//     <ThemeProvider
//       attribute="class"
//       defaultTheme="light"
//       forcedTheme="light"
//       enableSystem={false}
//       disableTransitionOnChange
//     >
//       <SidebarProvider
//         defaultOpen={false}
//         style={
//           {
//             "--sidebar-width": "18rem",
//             "--header-height": "3rem",
//           } as React.CSSProperties
//         }
//       >
//         <AppSidebar variant="sidebar" />
//         <SidebarInset>
//           <SiteHeader />
//           <div className="flex flex-1 flex-col">
//             <div className="@container/main flex flex-1 flex-col">{content}</div>
//           </div>
//         </SidebarInset>
//       </SidebarProvider>
//       <Toaster />
//     </ThemeProvider>
//   );
// }

import * as React from "react";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { useHashPath } from "@/lib/router";

import { DashboardPage } from "@/src/pages/DashboardPage";
import { CreateCanvasPage } from "@/src/pages/CreateCanvasPage";
import { CanvasPage } from "@/src/pages/CanvasPage";
import { CanvasResultPage } from "@/src/pages/CanvasResultPage";
import { UserManagementPage } from "@/src/pages/UserManagementPage";
import { NotFoundPage } from "@/src/pages/NotFoundPage";

export function App(): React.ReactElement {
  const path = useHashPath();

  let content: React.ReactNode = <NotFoundPage />;
  if (path === "/" || path === "") {
    content = <DashboardPage />;
  } else if (path === "/canvas/create") {
    content = <CreateCanvasPage />;
  } else if (path === "/canvas/result") {
    content = <CanvasResultPage />;
  } else if (path === "/canvas-preview") {
    const { CanvasPreviewPage } = require("@/src/pages/CanvasPreviewPage");
    content = <CanvasPreviewPage />;
  } else if (path.startsWith("/canvas/")) {
    content = <CanvasPage />;
  } else if (path === "/admin") {
    content = <UserManagementPage />;
  }

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <SidebarProvider
        defaultOpen={false}
        style={
          {
            "--sidebar-width": "18rem",
            "--header-height": "3rem",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="sidebar" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col">{content}</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </ThemeProvider>
  );
}