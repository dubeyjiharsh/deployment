import * as React from "react";
import { Routes, Route } from "react-router-dom";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { useHashPath } from "@/lib/router";

import { DashboardPage } from "@/src/pages/DashboardPage";
import { CreateCanvasPage } from "@/src/pages/CreateCanvasPage";
import { CanvasPage } from "@/src/pages/CanvasPage";
import { UserManagementPage } from "@/src/pages/UserManagementPage";
import { AdminConfigurePage } from "@/src/pages/AdminConfigurePage";
import { NotFoundPage } from "@/src/pages/NotFoundPage";
import { CanvasPreviewPage } from "@/src/pages/CanvasPreviewPage";
import { isAuthenticated, doLogin, isProjectAdmin } from "@/src/lib/auth";
import LogoutPage from "@/src/pages/LogoutPage";
import ErrorBoundary from "./components/ErrorBoundary";

export function App(): React.ReactElement {
  const path = useHashPath();
  const [isInitialized, setIsInitialized] = React.useState(false);

  // Clean up any malformed hashes on mount
  React.useEffect(() => {
    const hash = window.location.hash;

    // Fix malformed hashes
    if (hash.includes('%2F')) {
      console.log("Cleaning malformed hash:", hash);
      
      // Extract the intended path
      let targetPath = '/';
      if (hash.includes('logout')) {
        targetPath = '/logout';
      } else if (hash.includes('dashboard')) {
        targetPath = '/';
      } else if (hash.includes('admin-configure')) {
        targetPath = '/admin-configure';
      }
      
      window.history.replaceState(null, '', `${window.location.origin}/#${targetPath}`);
    }
    
    // Fix double slashes
    if (hash.startsWith('#//')) {
      console.log("Fixing double slashes in hash:", hash);
      window.history.replaceState(null, '', hash.replace('#//', '#/'));
    }
  }, []);

  // Decode and clean the path
  let cleanPath = path;
  try {
    cleanPath = decodeURIComponent(path);
  } catch (e) {
    console.error("Error decoding path:", e);
    cleanPath = '/';
  }

  // Additional cleanup for edge cases
  if (cleanPath.includes('//') || cleanPath.includes('=') || cleanPath.includes('%')) {
    console.log("Detected problematic path:", cleanPath);
    
    if (cleanPath.includes('logout')) {
      cleanPath = '/logout';
    } else if (cleanPath.includes('dashboard')) {
      cleanPath = '/';
    } else if (cleanPath.includes('admin-configure')) {
      cleanPath = '/admin-configure';
    } else {
      cleanPath = '/';
    }
  }

  React.useEffect(() => {
    const timer = setTimeout(() => setIsInitialized(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Wait for initialization before checking auth
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  const authStatus = isAuthenticated();

  console.log("Auth status:", authStatus, "Original Path:", path, "Clean Path:", cleanPath);

  // Check if we are currently in the middle of a login redirect
  const isAuthCallback = window.location.hash.includes("state=") || 
                        window.location.search.includes("state=") ||
                        window.location.hash.includes("code=");

  console.log("Is auth callback:", isAuthCallback);

  // LOGOUT PAGE - Always allow access, authenticated or not
  if (cleanPath === "/logout") {
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
          style={{ "--sidebar-width": "18rem", "--header-height": "3rem" } as React.CSSProperties}
        >
          <AppSidebar variant="sidebar" />
          <SidebarInset>
            <SiteHeader />
            <div className="flex flex-1 flex-col">
              <div className="@container/main flex flex-1 flex-col">
                <LogoutPage />
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </ThemeProvider>
    );
  }

  // If not authenticated and not in the middle of a callback, redirect to login
  if (!authStatus && !isAuthCallback) {
    console.log("Not authenticated, redirecting to login...");
    doLogin();
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg animate-pulse">Connecting to Keycloak...</p>
        </div>
      </div>
    );
  }

  console.log("Routing to:", cleanPath);

  // Protected route guard for admin-configure
  const ProtectedAdminRoute = ({ children }: { children: React.ReactNode }) => {
    if (!isProjectAdmin()) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
            <p className="text-gray-600 mb-4">
              You do not have permission to access this page.
            </p>
            <p className="text-sm text-gray-500">
              This page is only accessible to Project Administrators.
            </p>
          </div>
        </div>
      );
    }
    return <>{children}</>;
  };

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
        style={{ "--sidebar-width": "18rem", "--header-height": "3rem" } as React.CSSProperties}
      >
        <AppSidebar variant="sidebar" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col">
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/logout" element={<LogoutPage />} />
                  <Route path="/canvas/create" element={<CreateCanvasPage />} />
                  <Route path="/canvas-preview/:id" element={<CanvasPreviewPage />} />
                  <Route path="/canvas/:id" element={<CanvasPage />} />
                  <Route path="/admin" element={<UserManagementPage />} />
                  <Route 
                    path="/admin-configure" 
                    element={
                      <ProtectedAdminRoute>
                        <AdminConfigurePage />
                      </ProtectedAdminRoute>
                    } 
                  />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </ErrorBoundary>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;