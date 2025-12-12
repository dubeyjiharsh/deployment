import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

// Force Node.js runtime (required for database access)
export const runtime = "nodejs";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow API routes (including /api/auth/* which NextAuth needs)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Allow public routes
  const publicRoutes = ["/auth/signin", "/auth/change-password"];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check authentication
  const session = await auth();

  // Redirect to signin if not authenticated
  if (!session?.user) {
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Redirect to change password if required
  if (session.user.mustChangePassword && !pathname.startsWith("/auth/change-password")) {
    const changePasswordUrl = new URL("/auth/change-password", request.url);
    return NextResponse.redirect(changePasswordUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
