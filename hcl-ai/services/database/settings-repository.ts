import { nanoid } from "nanoid";
import type {
  CompanySettings,
  CompanyDocument,
  CompanySettingsWithDocuments,
} from "@/lib/validators/settings-schema";
import { getDatabase } from "./client";
import { encrypt, decrypt } from "@/lib/encryption";

/**
 * Repository for company settings operations
 */
export class SettingsRepository {
  /**
   * Gets the current company settings (singleton pattern)
   */
  async getSettings(): Promise<CompanySettingsWithDocuments | null> {
    const db = await getDatabase();

    const settingsRow = await db.queryOne(
      `SELECT id, company_name, industry, company_info, llm_provider, claude_api_key, openai_api_key,
              enable_thinking, canvas_fields, role_definitions, field_availability, created_at, updated_at
       FROM company_settings
       LIMIT 1`
    ) as
      | {
          id: string;
          company_name: string | null;
          industry: string | null;
          company_info: string | null;
          llm_provider: string | null;
          claude_api_key: string | null;
          openai_api_key: string | null;
          enable_thinking: number | boolean | null;
          canvas_fields: string | null;
          role_definitions: string | null;
          field_availability: string | null;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!settingsRow) {
      return null;
    }

    const documents = await this.getDocuments();

    // Decrypt API keys if they exist
    let claudeApiKey: string | undefined;
    let openaiApiKey: string | undefined;

    try {
      claudeApiKey = settingsRow.claude_api_key
        ? decrypt(settingsRow.claude_api_key)
        : undefined;
    } catch (error) {
      // Only log in development - this is expected if encryption key changed
      if (process.env.NODE_ENV === "development") {
        console.warn("[SETTINGS] Failed to decrypt Claude API key - encryption key may have changed");
      }
      claudeApiKey = undefined;
    }

    try {
      openaiApiKey = settingsRow.openai_api_key
        ? decrypt(settingsRow.openai_api_key)
        : undefined;
    } catch (error) {
      // Only log in development - this is expected if encryption key changed
      if (process.env.NODE_ENV === "development") {
        console.warn("[SETTINGS] Failed to decrypt OpenAI API key - encryption key may have changed");
      }
      openaiApiKey = undefined;
    }

    // Parse canvas fields from JSON
    let canvasFields;
    try {
      canvasFields = settingsRow.canvas_fields ? JSON.parse(settingsRow.canvas_fields) : undefined;
    } catch (error) {
      console.warn("[SETTINGS] Failed to parse canvas_fields JSON:", error);
      canvasFields = undefined;
    }

    // Parse role definitions from JSON
    let roleDefinitions;
    try {
      roleDefinitions = settingsRow.role_definitions ? JSON.parse(settingsRow.role_definitions) : undefined;
    } catch (error) {
      console.warn("[SETTINGS] Failed to parse role_definitions JSON:", error);
      roleDefinitions = undefined;
    }

    // Parse field availability from JSON
    let fieldAvailability;
    try {
      fieldAvailability = settingsRow.field_availability ? JSON.parse(settingsRow.field_availability) : undefined;
    } catch (error) {
      console.warn("[SETTINGS] Failed to parse field_availability JSON:", error);
      fieldAvailability = undefined;
    }

    return {
      id: settingsRow.id,
      companyName: settingsRow.company_name || undefined,
      industry: settingsRow.industry as CompanySettings["industry"],
      companyInfo: settingsRow.company_info || undefined,
      llmProvider: (settingsRow.llm_provider || "claude") as CompanySettings["llmProvider"],
      claudeApiKey,
      openaiApiKey,
      enableThinking: settingsRow.enable_thinking === true || settingsRow.enable_thinking === 1,
      canvasFields,
      roleDefinitions,
      fieldAvailability,
      createdAt: settingsRow.created_at,
      updatedAt: settingsRow.updated_at,
      documents,
    };
  }

  /**
   * Creates or updates company settings (upsert)
   */
  async upsertSettings(settings: Partial<CompanySettings>): Promise<CompanySettings> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    const existing = await this.getSettings();

    if (existing) {
      // Merge with existing values - only update fields that are explicitly provided
      const mergedCompanyName = settings.companyName !== undefined ? settings.companyName : existing.companyName;
      const mergedIndustry = settings.industry !== undefined ? settings.industry : existing.industry;
      const mergedCompanyInfo = settings.companyInfo !== undefined ? settings.companyInfo : existing.companyInfo;
      const mergedLlmProvider = settings.llmProvider !== undefined ? settings.llmProvider : existing.llmProvider;
      const mergedCanvasFields = settings.canvasFields !== undefined ? settings.canvasFields : existing.canvasFields;
      const mergedRoleDefinitions = settings.roleDefinitions !== undefined ? settings.roleDefinitions : (existing as CompanySettingsWithDocuments).roleDefinitions;
      const mergedFieldAvailability = settings.fieldAvailability !== undefined ? settings.fieldAvailability : (existing as CompanySettingsWithDocuments).fieldAvailability;

      // Encrypt API keys before storing - preserve existing if not provided
      const encryptedClaudeKey = settings.claudeApiKey !== undefined
        ? (settings.claudeApiKey ? encrypt(settings.claudeApiKey) : null)
        : (existing.claudeApiKey ? encrypt(existing.claudeApiKey) : null);
      const encryptedOpenAiKey = settings.openaiApiKey !== undefined
        ? (settings.openaiApiKey ? encrypt(settings.openaiApiKey) : null)
        : (existing.openaiApiKey ? encrypt(existing.openaiApiKey) : null);

      const enableThinking = settings.enableThinking ?? existing.enableThinking ?? false;

      // Serialize canvas fields to JSON
      const canvasFieldsJson = mergedCanvasFields ? JSON.stringify(mergedCanvasFields) : null;
      const roleDefinitionsJson = mergedRoleDefinitions ? JSON.stringify(mergedRoleDefinitions) : null;
      const fieldAvailabilityJson = mergedFieldAvailability ? JSON.stringify(mergedFieldAvailability) : null;

      await db.execute(
        `UPDATE company_settings
         SET company_name = $1,
             industry = $2,
             company_info = $3,
             llm_provider = $4,
             claude_api_key = $5,
             openai_api_key = $6,
             enable_thinking = $7,
             canvas_fields = $8,
             role_definitions = $9,
             field_availability = $10,
             updated_at = $11
         WHERE id = $12`,
        [
          mergedCompanyName || null,
          mergedIndustry || null,
          mergedCompanyInfo || null,
          mergedLlmProvider || null,
          encryptedClaudeKey,
          encryptedOpenAiKey,
          enableThinking ? 1 : 0,
          canvasFieldsJson,
          roleDefinitionsJson,
          fieldAvailabilityJson,
          now,
          existing.id
        ]
      );
      return {
        id: existing.id,
        companyName: mergedCompanyName,
        industry: mergedIndustry,
        companyInfo: mergedCompanyInfo,
        llmProvider: mergedLlmProvider,
        claudeApiKey: settings.claudeApiKey !== undefined ? settings.claudeApiKey : existing.claudeApiKey,
        openaiApiKey: settings.openaiApiKey !== undefined ? settings.openaiApiKey : existing.openaiApiKey,
        enableThinking,
        canvasFields: mergedCanvasFields,
        roleDefinitions: mergedRoleDefinitions,
        fieldAvailability: mergedFieldAvailability,
        createdAt: existing.createdAt,
        updatedAt: now,
      };
    }

    const id = nanoid();

    // Encrypt API keys before storing
    const encryptedClaudeKey = settings.claudeApiKey
      ? encrypt(settings.claudeApiKey)
      : null;
    const encryptedOpenAiKey = settings.openaiApiKey
      ? encrypt(settings.openaiApiKey)
      : null;

    const enableThinking = settings.enableThinking ?? false;

    // Serialize canvas fields to JSON
    const canvasFieldsJson = settings.canvasFields ? JSON.stringify(settings.canvasFields) : null;
    const roleDefinitionsJson = settings.roleDefinitions ? JSON.stringify(settings.roleDefinitions) : null;
    const fieldAvailabilityJson = settings.fieldAvailability ? JSON.stringify(settings.fieldAvailability) : null;

    await db.execute(
      `INSERT INTO company_settings (id, company_name, industry, company_info, llm_provider, claude_api_key, openai_api_key, enable_thinking, canvas_fields, role_definitions, field_availability, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        id,
        settings.companyName || null,
        settings.industry || null,
        settings.companyInfo || null,
        settings.llmProvider || null,
        encryptedClaudeKey,
        encryptedOpenAiKey,
        enableThinking ? 1 : 0,
        canvasFieldsJson,
        roleDefinitionsJson,
        fieldAvailabilityJson,
        now,
        now
      ]
    );

    return {
      id,
      companyName: settings.companyName,
      industry: settings.industry,
      companyInfo: settings.companyInfo,
      llmProvider: settings.llmProvider,
      claudeApiKey: settings.claudeApiKey,
      openaiApiKey: settings.openaiApiKey,
      enableThinking,
      canvasFields: settings.canvasFields,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Deletes company settings
   */
  async deleteSettings(): Promise<void> {
    const db = await getDatabase();
    await db.execute("DELETE FROM company_settings");
  }

  /**
   * Gets all company documents
   */
  async getDocuments(): Promise<CompanyDocument[]> {
    const db = await getDatabase();

    const rows = await db.query(
      `SELECT id, filename, content, mime_type, uploaded_at
       FROM company_documents
       ORDER BY uploaded_at DESC`
    ) as Array<{
      id: string;
      filename: string;
      content: string;
      mime_type: string | null;
      uploaded_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      content: row.content,
      mimeType: row.mime_type || undefined,
      uploadedAt: row.uploaded_at,
    }));
  }

  /**
   * Gets a single document by ID
   */
  async getDocumentById(id: string): Promise<CompanyDocument | null> {
    const db = await getDatabase();

    const row = await db.queryOne(
      `SELECT id, filename, content, mime_type, uploaded_at
       FROM company_documents
       WHERE id = $1`,
      [id]
    ) as
      | {
          id: string;
          filename: string;
          content: string;
          mime_type: string | null;
          uploaded_at: string;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      filename: row.filename,
      content: row.content,
      mimeType: row.mime_type || undefined,
      uploadedAt: row.uploaded_at,
    };
  }

  /**
   * Adds a new document
   */
  async addDocument(document: {
    filename: string;
    content: string;
    mimeType?: string;
  }): Promise<CompanyDocument> {
    const db = await getDatabase();
    const id = nanoid();
    const now = new Date().toISOString();

    await db.execute(
      `INSERT INTO company_documents (id, filename, content, mime_type, uploaded_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        document.filename,
        document.content,
        document.mimeType || null,
        now
      ]
    );

    return {
      id,
      filename: document.filename,
      content: document.content,
      mimeType: document.mimeType,
      uploadedAt: now,
    };
  }

  /**
   * Deletes a document by ID
   */
  async deleteDocument(id: string): Promise<boolean> {
    const db = await getDatabase();

    await db.execute("DELETE FROM company_documents WHERE id = $1", [id]);

    return true;
  }

  /**
   * Deletes all documents
   */
  async deleteAllDocuments(): Promise<void> {
    const db = await getDatabase();
    await db.execute("DELETE FROM company_documents");
  }

  /**
   * Clears corrupted/invalid encrypted API keys from the database
   * Useful when encryption key has changed and old encrypted data can't be decrypted
   */
  async clearEncryptedApiKeys(): Promise<void> {
    const db = await getDatabase();
    await db.execute(
      `UPDATE company_settings
       SET claude_api_key = NULL,
           openai_api_key = NULL`
    );
    console.log("[SETTINGS] Cleared encrypted API keys from database");
  }
}

/**
 * Export singleton instance
 */
export const settingsRepository = new SettingsRepository();
