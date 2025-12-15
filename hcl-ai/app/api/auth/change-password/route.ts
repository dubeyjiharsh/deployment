import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userRepository } from "@/services/database/user-repository";
import { rateLimit } from "@/lib/rate-limit";
import { auditLogger, AuditAction } from "@/lib/audit-logger";

/**
 * POST /api/auth/change-password
 * Allows users to change their own password
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Stricter rate limiting for password changes (3 attempts per hour)
    const rateLimitResponse = rateLimit(req, {
      limit: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
    });
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { newPassword } = body;

    if (!newPassword) {
      return NextResponse.json(
        { error: "New password is required" },
        { status: 400 }
      );
    }

    // Update password - this will validate the password strength
    try {
      const updated = await userRepository.updateUserPassword(session.user.id, newPassword);

      if (!updated) {
        auditLogger.logFailure(
          AuditAction.PASSWORD_CHANGED,
          session.user.id,
          "Failed to update password in database",
          {
            userEmail: session.user.email,
            ipAddress: req.headers.get("x-forwarded-for") || "unknown",
          }
        );
        return NextResponse.json(
          { error: "Failed to update password" },
          { status: 500 }
        );
      }

      // Log successful password change
      auditLogger.logSuccess(AuditAction.PASSWORD_CHANGED, session.user.id, {
        userEmail: session.user.email,
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      });

      return NextResponse.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      // Log failed password change due to validation errors
      auditLogger.logFailure(
        AuditAction.PASSWORD_CHANGED,
        session.user.id,
        error instanceof Error ? error.message : "Invalid password",
        {
          userEmail: session.user.email,
          ipAddress: req.headers.get("x-forwarded-for") || "unknown",
        }
      );
      // Password validation errors from the repository
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid password" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error changing password:", error);
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    );
  }
}
