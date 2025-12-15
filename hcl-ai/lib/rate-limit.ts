import { NextRequest, NextResponse } from "next/server";

/**
 * Simple in-memory rate limiter for API endpoints
 * For production, consider using Redis or a dedicated rate limiting service
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.requests.entries()) {
      if (now > entry.resetTime) {
        this.requests.delete(key);
      }
    }
  }

  /**
   * Check if request should be rate limited
   * @param identifier - Unique identifier for the client (IP or user ID)
   * @param limit - Maximum number of requests
   * @param windowMs - Time window in milliseconds
   * @returns true if rate limit exceeded, false otherwise
   */
  isRateLimited(
    identifier: string,
    limit: number,
    windowMs: number
  ): boolean {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    if (!entry || now > entry.resetTime) {
      // First request or window expired, reset
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + windowMs,
      });
      return false;
    }

    // Increment count
    entry.count++;

    if (entry.count > limit) {
      return true; // Rate limit exceeded
    }

    return false;
  }

  /**
   * Get current request count for identifier
   */
  getCount(identifier: string): number {
    const entry = this.requests.get(identifier);
    if (!entry || Date.now() > entry.resetTime) {
      return 0;
    }
    return entry.count;
  }

  /**
   * Get time until reset for identifier
   */
  getResetTime(identifier: string): number {
    const entry = this.requests.get(identifier);
    if (!entry) {
      return 0;
    }
    return Math.max(0, entry.resetTime - Date.now());
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

/**
 * Rate limiting options
 */
interface RateLimitOptions {
  /** Maximum number of requests per window */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Custom identifier function (defaults to IP address) */
  identifier?: (req: NextRequest) => string;
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
  /** Strict rate limit for auth endpoints */
  AUTH: { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 requests per 15 minutes
  /** Moderate rate limit for AI generation endpoints */
  AI_GENERATION: { limit: 20, windowMs: 60 * 1000 }, // 20 requests per minute
  /** General API rate limit */
  API: { limit: 100, windowMs: 60 * 1000 }, // 100 requests per minute
  /** Rate limit for settings endpoints (higher for polling) */
  SETTINGS: { limit: 60, windowMs: 60 * 1000 }, // 60 requests per minute
  /** Rate limit for MCP endpoints */
  MCP: { limit: 60, windowMs: 60 * 1000 }, // 60 requests per minute
};

/**
 * Get client identifier from request (IP address or user ID)
 * Implements secure IP extraction to prevent spoofing
 */
export function getClientIdentifier(req: NextRequest): string {
  // Only trust x-forwarded-for if explicitly configured
  // This should only be set to 'true' when behind a trusted reverse proxy (e.g., Nginx, Cloudflare)
  const trustProxy = process.env.TRUST_PROXY === "true";

  let ip = "unknown";

  if (trustProxy) {
    // When behind a trusted proxy, use x-forwarded-for
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) {
      // Take the first IP in the chain (client IP)
      const clientIp = forwarded.split(",")[0].trim();
      // Basic validation that it looks like an IP address
      if (/^[\d.]+$/.test(clientIp) || /^[a-fA-F0-9:]+$/.test(clientIp)) {
        ip = clientIp;
      }
    }
  }

  // Fallback to other headers if x-forwarded-for not available
  if (ip === "unknown") {
    ip = req.headers.get("x-real-ip") || "unknown";
  }

  return ip;
}

/**
 * Rate limiting middleware
 * @param req - Next.js request object
 * @param options - Rate limit options
 * @returns NextResponse if rate limited, null otherwise
 */
export function rateLimit(
  req: NextRequest,
  options: RateLimitOptions
): NextResponse | null {
  const identifier = options.identifier
    ? options.identifier(req)
    : getClientIdentifier(req);

  const isLimited = rateLimiter.isRateLimited(
    identifier,
    options.limit,
    options.windowMs
  );

  if (isLimited) {
    const resetTime = rateLimiter.getResetTime(identifier);
    const retryAfter = Math.ceil(resetTime / 1000);

    return NextResponse.json(
      {
        error: "Too many requests",
        message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
        retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfter.toString(),
          "X-RateLimit-Limit": options.limit.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": new Date(
            Date.now() + resetTime
          ).toISOString(),
        },
      }
    );
  }

  return null; // Not rate limited
}

/**
 * Convenience function for auth endpoints
 */
export function rateLimitAuth(req: NextRequest): NextResponse | null {
  return rateLimit(req, RATE_LIMITS.AUTH);
}

/**
 * Convenience function for AI generation endpoints
 */
export function rateLimitAI(req: NextRequest): NextResponse | null {
  return rateLimit(req, RATE_LIMITS.AI_GENERATION);
}

/**
 * Convenience function for general API endpoints
 */
export function rateLimitAPI(req: NextRequest): NextResponse | null {
  return rateLimit(req, RATE_LIMITS.API);
}

/**
 * Convenience function for settings endpoints
 */
export function rateLimitSettings(req: NextRequest): NextResponse | null {
  return rateLimit(req, RATE_LIMITS.SETTINGS);
}

/**
 * Convenience function for MCP endpoints
 */
export function rateLimitMCP(req: NextRequest): NextResponse | null {
  return rateLimit(req, RATE_LIMITS.MCP);
}

export { rateLimiter };
