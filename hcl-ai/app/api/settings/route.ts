import { NextRequest, NextResponse } from "next/server";
import { settingsRepository } from "@/services/database/settings-repository";
import { updateCompanySettingsSchema } from "@/lib/validators/settings-schema";
import { auth } from "@/lib/auth";
import { rateLimitSettings } from "@/lib/rate-limit";

// Force Node.js runtime for larger body handling
export const runtime = "nodejs";
// Increase max duration for large payloads
export const maxDuration = 30;

/**
 * GET /api/settings
 * Retrieves the current company settings
 */
export async function GET(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = rateLimitSettings(req);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can view settings
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const settings = await settingsRepository.getSettings();

    return NextResponse.json({
      settings: settings || null,
    });
  } catch (error) {
    console.error("Error fetching settings:", error);

    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings
 * Updates company settings
 */
export async function PUT(req: NextRequest) {
  // IMPORTANT: Read body FIRST before any other async operations
  // This prevents the body stream from being consumed by other middleware
  let body;
  try {
    const rawText = await req.text();
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to read request body" },
      { status: 400 }
    );
  }

  try {
    // Rate limiting
    const rateLimitResponse = rateLimitSettings(req);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can update settings
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const validatedData = updateCompanySettingsSchema.parse(body);

    await settingsRepository.upsertSettings(validatedData);
    const settings = await settingsRepository.getSettings();

    return NextResponse.json({
      settings,
      message: "Settings updated successfully",
    });
  } catch (error) {
    console.error("Error updating settings:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid settings data", details: error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings
 * Deletes company settings
 */
export async function DELETE(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = rateLimitSettings(req);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can delete settings
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await settingsRepository.deleteSettings();

    return NextResponse.json({
      message: "Settings deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting settings:", error);

    return NextResponse.json(
      { error: "Failed to delete settings" },
      { status: 500 }
    );
  }
}
