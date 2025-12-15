import { NextRequest, NextResponse } from "next/server";
import { auth } from "./auth";
import { rateLimit, RATE_LIMITS, getClientIdentifier } from "./rate-limit";
import type { Session } from "next-auth";

/**
 * API middleware options
 */
export interface ApiMiddlewareOptions {
  /** Require authentication */
  requireAuth?: boolean;
  /** Require admin role */
  requireAdmin?: boolean;
  /** Rate limit configuration */
  rateLimit?: {
    limit: number;
    windowMs: number;
    identifier?: (req: NextRequest) => string;
  };
}

/**
 * Default middleware options for different endpoint types
 */
export const MIDDLEWARE_PRESETS = {
  /** Public endpoint (no auth required) */
  PUBLIC: {
    requireAuth: false,
  },
  /** Authenticated endpoint */
  AUTH: {
    requireAuth: true,
    rateLimit: RATE_LIMITS.API,
  },
  /** Admin-only endpoint */
  ADMIN: {
    requireAuth: true,
    requireAdmin: true,
    rateLimit: RATE_LIMITS.SETTINGS,
  },
  /** AI generation endpoint (high rate limit) */
  AI: {
    requireAuth: true,
    rateLimit: RATE_LIMITS.AI_GENERATION,
  },
} as const;

/**
 * Applies API middleware (authentication, authorization, rate limiting)
 * @param req - Next.js request
 * @param options - Middleware options
 * @returns NextResponse with error if checks fail, null otherwise
 */
export async function applyApiMiddleware(
  req: NextRequest,
  options: ApiMiddlewareOptions = {}
): Promise<{ response: NextResponse | null; session: Session | null }> {
  let session: Session | null = null;

  // Check authentication if required
  if (options.requireAuth) {
    session = await auth();

    if (!session?.user) {
      return {
        response: NextResponse.json(
          { error: "Unauthorized - Please sign in" },
          { status: 401 }
        ),
        session: null,
      };
    }

    // Check for forced password change
    if (session.user.mustChangePassword) {
      return {
        response: NextResponse.json(
          {
            error: "Password change required",
            message: "You must change your password before accessing this resource",
            mustChangePassword: true,
          },
          { status: 403 }
        ),
        session,
      };
    }

    // Check admin role if required
    if (options.requireAdmin && session.user.role !== "admin") {
      return {
        response: NextResponse.json(
          { error: "Forbidden - Admin access required" },
          { status: 403 }
        ),
        session,
      };
    }
  }

  // Apply rate limiting if configured (identify by user when available to avoid global collisions)
  if (options.rateLimit) {
    const rateLimitResponse = rateLimit(req, {
      ...options.rateLimit,
      identifier: options.rateLimit.identifier
        ? options.rateLimit.identifier
        : () => {
            if (session?.user?.id) {
              return `user:${session.user.id}`;
            }
            return getClientIdentifier(req);
          },
    });
    if (rateLimitResponse) {
      return { response: rateLimitResponse, session };
    }
  }

  return { response: null, session };
}
