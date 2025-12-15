/**
 * Audit logging utility for tracking sensitive operations
 * For production, consider sending logs to a dedicated logging service (e.g., Datadog, Sentry)
 */

import fs from "fs";
import path from "path";

export enum AuditAction {
  USER_CREATED = "user.created",
  USER_DELETED = "user.deleted",
  USER_UPDATED = "user.updated",
  PASSWORD_CHANGED = "password.changed",
  PASSWORD_RESET = "password.reset",
  LOGIN_SUCCESS = "auth.login.success",
  LOGIN_FAILED = "auth.login.failed",
  LOGOUT = "auth.logout",
  CANVAS_CREATED = "canvas.created",
  CANVAS_UPDATED = "canvas.updated",
  CANVAS_DELETED = "canvas.deleted",
  CANVAS_SHARED = "canvas.shared",
  DOCUMENT_UPLOADED = "document.uploaded",
  DOCUMENT_DELETED = "document.deleted",
  SETTINGS_UPDATED = "settings.updated",
  API_KEY_ADDED = "api_key.added",
  API_KEY_REMOVED = "api_key.removed",
}

export interface AuditLogEntry {
  timestamp: string;
  action: AuditAction;
  userId: string;
  userEmail?: string;
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
}

const AUDIT_LOG_PATH = path.join(process.cwd(), "data", "audit.log");

class AuditLogger {
  /**
   * Log an audit event
   */
  log(entry: Omit<AuditLogEntry, "timestamp">): void {
    const logEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    // For development: log to console
    // For production: send to logging service (Datadog, Sentry, CloudWatch, etc.)
    console.log("[AUDIT]", JSON.stringify(logEntry));

    // Persist audit events to local log file for traceability
    try {
      const logDir = path.dirname(AUDIT_LOG_PATH);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      fs.appendFileSync(AUDIT_LOG_PATH, `${JSON.stringify(logEntry)}\n`, {
        encoding: "utf8",
      });
    } catch (error) {
      console.error("[AUDIT] Failed to persist audit log:", error);
    }
  }

  /**
   * Log a successful operation
   */
  logSuccess(
    action: AuditAction,
    userId: string,
    details?: {
      userEmail?: string;
      resource?: string;
      resourceId?: string;
      metadata?: Record<string, unknown>;
      ipAddress?: string;
      userAgent?: string;
    }
  ): void {
    this.log({
      action,
      userId,
      success: true,
      ...details,
    });
  }

  /**
   * Log a failed operation
   */
  logFailure(
    action: AuditAction,
    userId: string,
    error: string,
    details?: {
      userEmail?: string;
      resource?: string;
      resourceId?: string;
      metadata?: Record<string, unknown>;
      ipAddress?: string;
      userAgent?: string;
    }
  ): void {
    this.log({
      action,
      userId,
      success: false,
      metadata: {
        ...(details?.metadata || {}),
        error,
      },
      ...details,
    });
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();
