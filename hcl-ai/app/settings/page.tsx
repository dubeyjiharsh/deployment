"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Trash2, FileText, Loader2, ShieldAlert, Settings, FileStack, LayoutTemplate, ShieldCheck, Eye } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";
import { useSettingsStore } from "@/stores/settings-store";
import { FieldConfigurationPanel } from "@/components/settings/field-configuration-panel";
import { DEFAULT_CANVAS_FIELDS } from "@/lib/constants/default-canvas-fields";
import {
  INDUSTRIES,
  LLM_PROVIDERS,
  getIndustryDisplayName,
  getLlmProviderDisplayName,
  type Industry,
  type LlmProvider,
  type FieldConfiguration,
  type RoleDefinition,
  type FieldAvailability,
} from "@/lib/validators/settings-schema";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { RoleManagementPanel } from "@/components/settings/role-management-panel";
import { FieldAvailabilityMatrix } from "@/components/settings/field-availability-matrix";

const DEFAULT_ROLES: RoleDefinition[] = [
  {
    id: "admin",
    name: "Admin",
    description: "Full access to manage settings, fields, roles, and documents.",
    isSystem: true,
    permissions: {
      canManageFields: true,
      canManageTeams: true,
      canUploadDocs: true,
      canShareCanvas: true,
      canCreateCanvas: true,
      canEditCanvas: true,
    },
  },
  {
    id: "user",
    name: "User",
    description: "Can create and edit canvases and collaborate with others.",
    isSystem: true,
    permissions: {
      canManageFields: false,
      canManageTeams: false,
      canUploadDocs: true,
      canShareCanvas: true,
      canCreateCanvas: true,
      canEditCanvas: true,
    },
  },
  {
    id: "viewer",
    name: "Viewer",
    description: "Can view canvases and comment but cannot edit fields.",
    isSystem: true,
    permissions: {
      canManageFields: false,
      canManageTeams: false,
      canUploadDocs: false,
      canShareCanvas: false,
      canCreateCanvas: false,
      canEditCanvas: false,
    },
  },
];

interface TeamSummary {
  id: string;
  name: string;
  ownerId: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const {
    settings,
    isLoading,
    error,
    fetchSettings,
    updateSettings,
    generateCompanyInfo,
    uploadDocument,
    deleteDocument,
  } = useSettingsStore();

  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState<Industry | undefined>(undefined);
  const [companyInfo, setCompanyInfo] = useState("");
  const [llmProvider, setLlmProvider] = useState<LlmProvider>("claude");
  const [claudeApiKey, setClaudeApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [providerStatus, setProviderStatus] = useState<{
    claude: { hasEnvKey: boolean; source: string };
    openai: { hasEnvKey: boolean; source: string };
  } | null>(null);
  const [fieldConfiguration, setFieldConfiguration] = useState<FieldConfiguration[]>([]);
  const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinition[]>(DEFAULT_ROLES);
  const [fieldAvailability, setFieldAvailability] = useState<FieldAvailability[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [isSavingFields, setIsSavingFields] = useState(false);
  const [isSavingRoles, setIsSavingRoles] = useState(false);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);

  const syncAvailabilityWithFields = useCallback(
    (fields: FieldConfiguration[], availabilityState: FieldAvailability[]) => {
      const fieldKeys = new Set(fields.map((f) => f.fieldKey));
      const filtered = availabilityState.filter((entry) => fieldKeys.has(entry.fieldKey));
      const missing = fields
        .filter((field) => !filtered.some((entry) => entry.fieldKey === field.fieldKey))
        .map((field) => ({ fieldKey: field.fieldKey }));
      return [...filtered, ...missing];
    },
    []
  );

  const enforceSystemRoles = useCallback(
    (roles: RoleDefinition[]) => {
      const systemRoles = DEFAULT_ROLES.map((systemRole) => {
        const existing = roles.find((r) => r.id === systemRole.id);
        return existing
          ? { ...systemRole, ...existing, isSystem: true }
          : systemRole;
      });

      const customRoles = roles.filter(
        (role) => !DEFAULT_ROLES.some((sys) => sys.id === role.id)
      );

      return [...systemRoles, ...customRoles];
    },
    []
  );

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const session = await response.json();

        if (!session?.user || session.user.role !== "admin") {
          router.push("/");
          return;
        }

        setIsAdmin(true);
      } catch (error) {
        console.error("Failed to check admin status:", error);
        router.push("/");
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAdmin();
  }, [router]);

  useEffect(() => {
    if (isAdmin) {
      fetchSettings();
      // Fetch provider status to check if API keys are set via environment variables
      fetch("/api/settings/provider-status")
        .then((res) => res.json())
        .then((data) => setProviderStatus(data.status))
        .catch((err) => console.error("Failed to fetch provider status:", err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    setIsLoadingTeams(true);
    fetch("/api/teams")
      .then((res) => res.json())
      .then((data) => setTeams(data.teams || []))
      .catch((err) => console.error("Failed to fetch teams:", err))
      .finally(() => setIsLoadingTeams(false));
  }, [isAdmin]);

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.companyName || "");
      setIndustry(settings.industry || undefined);
      setCompanyInfo(settings.companyInfo || "");
      setLlmProvider(settings.llmProvider || "claude");
      setClaudeApiKey(settings.claudeApiKey || "");
      setOpenaiApiKey(settings.openaiApiKey || "");
      const fields = settings.canvasFields || DEFAULT_CANVAS_FIELDS;
      setFieldConfiguration(fields);
      const hydratedRoles = enforceSystemRoles(settings.roleDefinitions || DEFAULT_ROLES);
      setRoleDefinitions(hydratedRoles);
      const syncedAvailability = syncAvailabilityWithFields(fields, settings.fieldAvailability || []);
      setFieldAvailability(syncedAvailability);
    }
  }, [enforceSystemRoles, settings, syncAvailabilityWithFields]);

  const handleGenerateCompanyInfo = async () => {
    if (!companyName || !industry) {
      toast.error("Please enter company name and select an industry first.");
      return;
    }

    setIsGenerating(true);

    try {
      const generatedInfo = await generateCompanyInfo(companyName, industry);
      setCompanyInfo(generatedInfo);

      toast.success("Company information has been generated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate company info");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);

    try {
      await updateSettings({
        companyName: companyName || undefined,
        industry,
        companyInfo: companyInfo || undefined,
        llmProvider,
        // Only send API keys if they're not set via environment variables
        claudeApiKey: providerStatus?.claude.hasEnvKey ? undefined : (claudeApiKey || undefined),
        openaiApiKey: providerStatus?.openai.hasEnvKey ? undefined : (openaiApiKey || undefined),
      });

      toast.success("Your company settings have been updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);

    try {
      await uploadDocument(file);

      toast.success(`${file.name} has been uploaded successfully.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (id: string, filename: string) => {
    try {
      await deleteDocument(id);

      toast.success(`${filename} has been removed.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete document");
    }
  };

  const handleUpdateFieldConfiguration = async (updatedFields: FieldConfiguration[]) => {
    setIsSavingFields(true);

    try {
      const nextAvailability = syncAvailabilityWithFields(updatedFields, fieldAvailability);
      await updateSettings({
        canvasFields: updatedFields,
        fieldAvailability: nextAvailability,
        roleDefinitions: enforceSystemRoles(roleDefinitions),
      });

      setFieldAvailability(nextAvailability);
      setFieldConfiguration(updatedFields);
      toast.success("Field configuration has been saved.");
    } catch (err) {
      console.error("[SettingsPage] Error saving field configuration:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save field configuration");
    } finally {
      setIsSavingFields(false);
    }
  };

  const handleSaveRoles = async (updatedRoles: RoleDefinition[]) => {
    setIsSavingRoles(true);
    try {
      const normalized = enforceSystemRoles(updatedRoles);
      await updateSettings({
        roleDefinitions: normalized,
      });
      setRoleDefinitions(normalized);
      toast.success("Roles have been updated.");
    } catch (err) {
      console.error("[SettingsPage] Error saving roles:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save roles");
    } finally {
      setIsSavingRoles(false);
    }
  };

  const handleAvailabilityChange = (next: FieldAvailability[]) => {
    const synced = syncAvailabilityWithFields(fieldConfiguration, next);
    setFieldAvailability(synced);
  };

  const handleSaveAvailability = async (next: FieldAvailability[]) => {
    setIsSavingAvailability(true);
    const synced = syncAvailabilityWithFields(fieldConfiguration, next);
    try {
      await updateSettings({
        fieldAvailability: synced,
        roleDefinitions: enforceSystemRoles(roleDefinitions),
      });
      setFieldAvailability(synced);
      toast.success("Availability has been updated.");
      return true;
    } catch (err) {
      console.error("[SettingsPage] Error saving availability:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save availability");
      return false;
    } finally {
      setIsSavingAvailability(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center max-w-md">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            You do not have permission to access this page. Only administrators can view settings.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading && !settings) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container w-full max-w-[1400px] px-6 py-8 md:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your company profile, manage documents, and customize the canvas generation experience.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileStack className="h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="canvas" className="flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4" />
            Canvas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                Provide company context to help the AI generate more relevant and accurate business canvases.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="flex flex-col gap-6">
                <Field>
                  <FieldLabel htmlFor="company-name">Company Name</FieldLabel>
                  <Input
                    id="company-name"
                    placeholder="e.g., GAP Inc."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                  <FieldDescription>
                    The name of your company or the client you&apos;re creating demos for
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="industry">Industry</FieldLabel>
                  <Select
                    value={industry}
                    onValueChange={(value) => setIndustry(value as Industry)}
                  >
                    <SelectTrigger id="industry">
                      <SelectValue placeholder="Select an industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((ind) => (
                        <SelectItem key={ind} value={ind}>
                          {getIndustryDisplayName(ind)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Industry-specific KPIs and recommendations will be applied
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="llm-provider">LLM Provider</FieldLabel>
                  <Select
                    value={llmProvider}
                    onValueChange={(value) => setLlmProvider(value as LlmProvider)}
                  >
                    <SelectTrigger id="llm-provider">
                      <SelectValue placeholder="Select a provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {LLM_PROVIDERS.map((provider) => (
                        <SelectItem key={provider} value={provider}>
                          {getLlmProviderDisplayName(provider)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Choose your AI provider (Anthropic Claude or OpenAI)
                  </FieldDescription>
                </Field>

                {llmProvider === "claude" && (
                  <Field>
                    <FieldLabel htmlFor="claude-api-key">Claude API Key</FieldLabel>
                    {providerStatus?.claude.hasEnvKey ? (
                      <div className="rounded-md border border-muted bg-muted/30 px-3 py-2">
                        <p className="text-sm text-muted-foreground">
                          ✓ Using API key from environment variable (ANTHROPIC_API_KEY)
                        </p>
                      </div>
                    ) : (
                      <Input
                        id="claude-api-key"
                        type="password"
                        placeholder="sk-ant-..."
                        value={claudeApiKey}
                        onChange={(e) => setClaudeApiKey(e.target.value)}
                      />
                    )}
                    <FieldDescription>
                      {providerStatus?.claude.hasEnvKey ? (
                        "API key is configured via environment variable. To use a different key, remove ANTHROPIC_API_KEY from your .env file."
                      ) : (
                        <>
                          Your Anthropic API key for Claude. Get one at{" "}
                          <a
                            href="https://console.anthropic.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            console.anthropic.com
                          </a>
                        </>
                      )}
                    </FieldDescription>
                  </Field>
                )}

                {llmProvider === "openai" && (
                  <Field>
                    <FieldLabel htmlFor="openai-api-key">OpenAI API Key</FieldLabel>
                    {providerStatus?.openai.hasEnvKey ? (
                      <div className="rounded-md border border-muted bg-muted/30 px-3 py-2">
                        <p className="text-sm text-muted-foreground">
                          ✓ Using API key from environment variable (OPENAI_API_KEY)
                        </p>
                      </div>
                    ) : (
                      <Input
                        id="openai-api-key"
                        type="password"
                        placeholder="sk-..."
                        value={openaiApiKey}
                        onChange={(e) => setOpenaiApiKey(e.target.value)}
                      />
                    )}
                    <FieldDescription>
                      {providerStatus?.openai.hasEnvKey ? (
                        "API key is configured via environment variable. To use a different key, remove OPENAI_API_KEY from your .env file."
                      ) : (
                        <>
                          Your OpenAI API key. Get one at{" "}
                          <a
                            href="https://platform.openai.com/api-keys"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            platform.openai.com
                          </a>
                        </>
                      )}
                    </FieldDescription>
                  </Field>
                )}

                <Field>
                  <FieldLabel htmlFor="company-info">Company Information</FieldLabel>
                  <InputGroup>
                    <InputGroupTextarea
                      id="company-info"
                      placeholder="Enter company information or generate with AI..."
                      value={companyInfo}
                      onChange={(e) => setCompanyInfo(e.target.value)}
                      rows={6}
                    />
                    <InputGroupAddon align="block-end">
                      <InputGroupButton
                        onClick={handleGenerateCompanyInfo}
                        disabled={isGenerating || !companyName || !industry}
                      >
                        {isGenerating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        <span className="ml-2">
                          {isGenerating ? "Generating..." : "Generate with AI"}
                        </span>
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldDescription>
                    Provide context about the company&apos;s business model, market position, and
                    strategic goals
                  </FieldDescription>
                </Field>

                <div className="flex justify-end">
                  <Button onClick={handleSaveSettings} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Settings
                  </Button>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Company Documents</CardTitle>
              <CardDescription>
                Upload documents to provide additional context for canvas generation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="flex flex-col gap-6">
                <Field>
                  <FieldLabel>Upload Documents</FieldLabel>
                  {isUploading ? (
                    <div className="flex items-center justify-center p-8 rounded-lg border-2 border-dashed border-muted-foreground/25">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mr-3" />
                      <span className="text-sm text-muted-foreground">Uploading...</span>
                    </div>
                  ) : (
                    <FileUpload
                      onFileSelect={handleFileUpload}
                      accept=".txt,.md"
                      maxSize={10}
                      disabled={isUploading}
                    />
                  )}
                  <FieldDescription>
                    Drag and drop files or click to browse • TXT, MD files up to 10MB
                  </FieldDescription>
                </Field>

                {settings?.documents && settings.documents.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Uploaded Documents</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {settings.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between rounded-lg border p-3 bg-background"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{doc.filename}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(doc.uploadedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDeleteDocument(doc.id, doc.filename)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="canvas">
          <Tabs defaultValue="fields" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 md:w-[520px]">
              <TabsTrigger value="fields" className="flex items-center gap-2">
                <LayoutTemplate className="h-4 w-4" />
                Fields
              </TabsTrigger>
              <TabsTrigger value="availability" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Availability
              </TabsTrigger>
              <TabsTrigger value="roles" className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Roles
              </TabsTrigger>
            </TabsList>

            <TabsContent value="fields" className="space-y-4">
              <FieldConfigurationPanel
                fields={fieldConfiguration}
                onUpdateFields={handleUpdateFieldConfiguration}
                isSaving={isSavingFields}
              />
            </TabsContent>

            <TabsContent value="availability" className="space-y-4">
              <FieldAvailabilityMatrix
                fields={fieldConfiguration}
                teams={teams}
                availability={fieldAvailability}
                onChangeAvailability={handleAvailabilityChange}
                onSave={handleSaveAvailability}
                isSaving={isSavingAvailability}
                isLoadingTeams={isLoadingTeams}
              />
            </TabsContent>

            <TabsContent value="roles" className="space-y-4">
              <RoleManagementPanel
                roles={roleDefinitions}
                onChangeRoles={setRoleDefinitions}
                onSave={handleSaveRoles}
                isSaving={isSavingRoles}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
