"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertCircle, Shield } from "lucide-react";
import type { FieldConfiguration, FieldAvailability, FieldAccessLevel } from "@/lib/validators/settings-schema";
import { useMemo, useRef } from "react";

interface TeamLite {
  id: string;
  name: string;
}

interface FieldAvailabilityMatrixProps {
  fields: FieldConfiguration[];
  teams: TeamLite[];
  availability: FieldAvailability[];
  onChangeAvailability: (availability: FieldAvailability[]) => void;
  onSave: (availability: FieldAvailability[]) => Promise<boolean> | boolean;
  isSaving: boolean;
  isLoadingTeams?: boolean;
}

const ACCESS_OPTIONS: Array<{ value: FieldAccessLevel; label: string; tone: string; description: string }> = [
  { value: "hidden", label: "Hidden", tone: "bg-slate-100 text-slate-800", description: "Field is not visible to this team." },
  { value: "read", label: "Read-only", tone: "bg-blue-100 text-blue-800", description: "Can view the field but cannot change it." },
  { value: "edit", label: "Editable", tone: "bg-emerald-100 text-emerald-800", description: "Can edit the field value." },
];

export function FieldAvailabilityMatrix({
  fields,
  teams,
  availability,
  onChangeAvailability,
  onSave,
  isSaving,
  isLoadingTeams = false,
}: FieldAvailabilityMatrixProps): React.ReactElement {
  const [isDirty, setIsDirty] = React.useState(false);
  const lastSavedAvailabilityRef = useRef<FieldAvailability[]>(availability);

  React.useEffect(() => {
    if (!isDirty) {
      lastSavedAvailabilityRef.current = availability;
    }
  }, [availability, isDirty]);

  const normalizeLevel = (value?: FieldAccessLevel): FieldAccessLevel => {
    // Treat legacy "required" as "edit" for simplicity
    if (value === "required") return "edit";
    return value || "edit";
  };

  const getAccessValue = (fieldKey: string, targetId: string): FieldAccessLevel => {
    const entry = availability.find((a) => a.fieldKey === fieldKey);
    if (!entry) return "edit";
    const map = entry.teamAccess;
    return normalizeLevel(map?.[targetId] as FieldAccessLevel);
  };

  const setAccessValue = (fieldKey: string, targetId: string, value: FieldAccessLevel): void => {
    const next = availability.map((entry) => ({ ...entry }));
    const idx = next.findIndex((entry) => entry.fieldKey === fieldKey);
    if (idx === -1) {
      onChangeAvailability([
        ...next,
        { fieldKey, teamAccess: { [targetId]: value } },
      ]);
      setIsDirty(true);
      return;
    }

    const entry = next[idx];
    entry.teamAccess = { ...(entry.teamAccess || {}), [targetId]: value };

    onChangeAvailability(next);
    setIsDirty(true);
  };

  const currentTargets = teams;
  const showScrollHint = currentTargets.length > 3;

  const handleSave = async (): Promise<void> => {
    const saved = await onSave(availability);
    if (saved !== false) {
      setIsDirty(false);
      lastSavedAvailabilityRef.current = availability;
    }
  };

  const describeEffective = (fieldKey: string, targetId: string): string => {
    const entry = availability.find((a) => a.fieldKey === fieldKey);
    const teamAccess = entry?.teamAccess || {};
    const level = normalizeLevel(teamAccess[targetId] as FieldAccessLevel);
    const source = teamAccess[targetId] !== undefined ? "Team setting" : "Default (all teams)";
    return `${source}: ${ACCESS_OPTIONS.find((o) => o.value === level)?.label || level}. Rule: hidden > read-only > editable. Users without a team see all enabled fields.`;
  };

  const changeCount = useMemo(() => {
    const normalize = (list: FieldAvailability[]) =>
      [...list]
        .sort((a, b) => a.fieldKey.localeCompare(b.fieldKey))
        .map((item) => ({
          fieldKey: item.fieldKey,
          teamAccess: item.teamAccess ? Object.fromEntries(Object.entries(item.teamAccess).sort()) : undefined,
        }));

    const currentNorm = normalize(availability);
    const baselineNorm = normalize(lastSavedAvailabilityRef.current);
    return JSON.stringify(currentNorm) === JSON.stringify(baselineNorm)
      ? 0
      : currentNorm.filter((item, idx) => JSON.stringify(item) !== JSON.stringify(baselineNorm[idx])).length || currentNorm.length;
  }, [availability]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Availability</CardTitle>
        <CardDescription>
          Control which fields each team can see or edit. If a user has no team, they see all enabled fields.
        </CardDescription>
        <div className="mt-2 rounded-md border bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <p className="font-medium">How access is resolved</p>
          <p>
            Team setting only. Stricter wins: <span className="font-semibold">hidden</span> &gt;{" "}
            <span className="font-semibold">read-only</span> &gt; <span className="font-semibold">editable</span>.
            Users without a team see all enabled fields.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {showScrollHint && (
              <span className="text-xs text-muted-foreground">Scroll sideways to see all teams →</span>
            )}
            {isLoadingTeams && (
              <span className="text-xs text-muted-foreground">Loading teams…</span>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-800">
          <Shield className="h-4 w-4 shrink-0 text-slate-600" />
          <div className="space-y-1">
            <p className="font-medium">Defaults</p>
            <p>
              If no team setting is defined, the field is editable for everyone. Hidden always hides; read-only removes editing.
              Users without a team see all enabled fields.
            </p>
            <p className="text-slate-600">
              Levels: <span className="font-semibold">Hidden</span> (not shown),{" "}
              <span className="font-semibold">Read-only</span> (view only),{" "}
              <span className="font-semibold">Editable</span> (can change values).
            </p>
          </div>
        </div>

        <div className="w-full overflow-auto rounded-lg border">
          <div className="relative min-w-[760px]">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-white">
                <TableRow>
                  <TableHead className="sticky left-0 z-20 w-56 bg-white">Field</TableHead>
                  {currentTargets.map((target) => (
                    <TableHead key={target.id} className="min-w-[140px] bg-white">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">Team</Badge>
                          <span className="font-medium">{target.name || target.id}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">Access level</span>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field) => (
                  <TableRow key={field.fieldKey}>
                    <TableCell className="sticky left-0 z-10 bg-white align-top">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{field.name}</span>
                          {!field.enabled && (
                            <Badge variant="destructive" className="text-[10px]">
                              Disabled globally
                            </Badge>
                          )}
                        </div>
                        {field.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{field.description}</p>
                        )}
                      </div>
                    </TableCell>
                    {currentTargets.map((target) => {
                      const level = getAccessValue(field.fieldKey, target.id);
                      const entry = availability.find((a) => a.fieldKey === field.fieldKey);
                      const overrideExists = entry?.teamAccess && entry.teamAccess[target.id] !== undefined;
                      const tooltip = describeEffective(field.fieldKey, target.id);
                      return (
                        <TableCell key={`${field.fieldKey}-${target.id}`} title={tooltip}>
                          <div className="flex items-center gap-2">
                            <Select
                              value={level}
                              onValueChange={(val) =>
                                setAccessValue(field.fieldKey, target.id, val as FieldAccessLevel)
                              }
                            >
                              <SelectTrigger className="h-9 w-full justify-start text-left">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ACCESS_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value} title={opt.description}>
                                    <div className="flex flex-col">
                                      <span>{opt.label}</span>
                                      <span className="text-[11px] text-muted-foreground">{opt.description}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {overrideExists && (
                              <Badge variant="secondary" className="text-[10px]">
                                Override
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between rounded-lg border bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-amber-700">
            <AlertCircle className="h-4 w-4" />
            <span>
              {isDirty
                ? `Unsaved availability changes${changeCount ? ` (${changeCount})` : ""}`
                : "No availability changes"}
            </span>
          </div>
          <Button onClick={handleSave} disabled={!isDirty || isSaving} size="sm" variant={isDirty ? "default" : "outline"}>
            {isSaving ? "Saving..." : "Save availability"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
