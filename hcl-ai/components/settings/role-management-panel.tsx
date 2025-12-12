"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { AlertCircle, Lock, Plus } from "lucide-react";
import { nanoid } from "nanoid";
import type { RoleDefinition } from "@/lib/validators/settings-schema";

const permissionToggles: Array<{
  key: keyof NonNullable<RoleDefinition["permissions"]>;
  label: string;
  description: string;
}> = [
  {
    key: "canManageFields",
    label: "Manage fields & availability",
    description: "Create, edit, and reorder canvas fields; adjust who can see them.",
  },
  {
    key: "canManageTeams",
    label: "Manage teams",
    description: "Create or update teams and membership.",
  },
  {
    key: "canUploadDocs",
    label: "Upload RAG documents",
    description: "Add or remove contextual documents for canvases.",
  },
  {
    key: "canShareCanvas",
    label: "Share canvases",
    description: "Invite collaborators and set sharing roles.",
  },
];

interface RoleManagementPanelProps {
  roles: RoleDefinition[];
  onChangeRoles: (roles: RoleDefinition[]) => void;
  onSave: (roles: RoleDefinition[]) => Promise<void> | void;
  isSaving: boolean;
}

function slugifyLabel(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || `role-${nanoid(4)}`;
}

export function RoleManagementPanel({
  roles,
  onChangeRoles,
  onSave,
  isSaving,
}: RoleManagementPanelProps): React.ReactElement {
  const [localRoles, setLocalRoles] = React.useState<RoleDefinition[]>(roles);
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    setLocalRoles(roles);
  }, [roles]);

  const updateRoles = (next: RoleDefinition[]): void => {
    setLocalRoles(next);
    onChangeRoles(next);
    setDirty(true);
  };

  const handleAddRole = (): void => {
    const baseName = `Custom role ${localRoles.length + 1}`;
    const newRole: RoleDefinition = {
      id: slugifyLabel(baseName),
      name: baseName,
      description: "Describe what this role can do",
      isSystem: false,
      permissions: {
        canShareCanvas: true,
        canUploadDocs: true,
      },
    };
    updateRoles([...localRoles, newRole]);
  };

  const handleUpdateRole = (id: string, patch: Partial<RoleDefinition>): void => {
    updateRoles(
      localRoles.map((role) =>
        role.id === id
          ? {
              ...role,
              ...patch,
              permissions: { ...role.permissions, ...patch.permissions },
            }
          : role
      )
    );
  };

  const handleDeleteRole = (id: string): void => {
    const role = localRoles.find((r) => r.id === id);
    if (role?.isSystem) return;
    updateRoles(localRoles.filter((r) => r.id !== id));
  };

  const handleSave = async (): Promise<void> => {
    await onSave(localRoles);
    setDirty(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles</CardTitle>
        <CardDescription>
          Create custom roles and tune what each role can do. Admin stays locked as the top-level role.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm text-blue-900">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>
            Role names become the values stored on users (e.g., <span className="font-semibold">admin</span>,{" "}
            <span className="font-semibold">sales-lead</span>). Keep them stable to avoid confusion.
          </p>
        </div>

        <div className="space-y-4">
          {localRoles.map((role) => (
            <div key={role.id} className="rounded-lg border p-4 shadow-sm">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 space-y-2 min-w-[220px]">
                  <Label htmlFor={`role-name-${role.id}`}>Role name</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`role-name-${role.id}`}
                      value={role.name}
                      disabled={role.isSystem}
                      onChange={(e) =>
                        handleUpdateRole(role.id, { name: e.target.value })
                      }
                      placeholder="e.g., Product Manager"
                    />
                    {role.isSystem && (
                      <Badge variant="secondary" className="gap-1">
                        <Lock className="h-3 w-3" />
                        System
                      </Badge>
                    )}
                  </div>
                </div>
                {!role.isSystem && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteRole(role.id)}
                    className="text-destructive"
                  >
                    Remove
                  </Button>
                )}
              </div>

              <div className="mt-3 space-y-2">
                <Label htmlFor={`role-desc-${role.id}`}>Description</Label>
                <Textarea
                  id={`role-desc-${role.id}`}
                  value={role.description || ""}
                  onChange={(e) =>
                    handleUpdateRole(role.id, { description: e.target.value })
                  }
                  placeholder="Describe responsibilities or access this role should have"
                  rows={2}
                />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {permissionToggles.map((perm) => (
                  <label
                    key={`${role.id}-${perm.key}`}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <Switch
                      checked={Boolean(role.permissions?.[perm.key])}
                      disabled={role.isSystem}
                      onCheckedChange={(checked) =>
                        handleUpdateRole(role.id, {
                          permissions: { [perm.key]: checked },
                        })
                      }
                    />
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{perm.label}</p>
                      <p className="text-xs text-muted-foreground">{perm.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <Button variant="outline" size="sm" onClick={handleAddRole}>
            <Plus className="mr-2 h-4 w-4" />
            Add role
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {dirty ? "Unsaved role changes" : "No role changes"}
            </span>
            <Button
              onClick={handleSave}
              disabled={!dirty || isSaving}
              size="sm"
              variant={dirty ? "default" : "outline"}
            >
              {isSaving ? "Saving..." : "Save roles"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
