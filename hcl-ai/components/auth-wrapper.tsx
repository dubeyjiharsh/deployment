"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { Loader2 } from "lucide-react";

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if we're on a public route
        if (pathname?.startsWith("/auth/signin")) {
          setIsChecking(false);
          return;
        }

        // Check session
        const response = await fetch("/api/auth/session");
        const session = await response.json();

        if (!session?.user) {
          router.push(`/auth/signin?callbackUrl=${encodeURIComponent(pathname || "/")}`);
        } else {
          // Check if password change is required
          if (session.user.mustChangePassword && !pathname?.startsWith("/auth/change-password")) {
            router.push("/auth/change-password");
            return;
          }

          setIsAuthenticated(true);
          setIsChecking(false);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/auth/signin");
      }
    };

    checkAuth();
  }, [pathname, router]);

  // Show loading state while checking auth (except on signin page)
  if (isChecking && !pathname?.startsWith("/auth/signin")) {
    return (
      <SessionProvider>
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="mt-4 text-sm text-muted-foreground">Checking authentication...</p>
          </div>
        </div>
      </SessionProvider>
    );
  }

  return <SessionProvider>{children}</SessionProvider>;
}
