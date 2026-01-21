"use client";
 
import * as React from "react";
import { ChevronDown, Loader2, Pencil } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
 
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StructuredFieldEditor } from "@/components/canvas/structured-field-editor";
import { cn } from "@/lib/utils";
import { DEFAULT_CANVAS_FIELDS } from "@/lib/constants/default-canvas-fields";
import type { BusinessCanvas, CanvasField, EvidenceItem } from "@/lib/validators/canvas-schema";
import {
  NFR_CATEGORY_LABELS,
  nfrCategoryKeys,
  GOVERNANCE_CATEGORY_LABELS,
  // SCOPE_CATEGORY_LABELS,
} from "@/lib/validators/structured-field-schemas";
 
function isCanvasField(value: unknown): value is CanvasField<unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    "value" in value &&
    "confidence" in value &&
    "evidence" in value
  );
}
 
function defaultValueForType(valueType?: string): unknown {
  if (valueType === "array") return [];
  if (valueType === "object") return {};
  return "";
}
 
function ensureField(value: unknown, valueType?: string): CanvasField<unknown> {
  if (isCanvasField(value)) return value;
  return {
    value: value ?? defaultValueForType(valueType),
    evidence: [],
    confidence: 0.5,
  };
}
 
function EvidenceMenu({ evidence }: { evidence: EvidenceItem[] | undefined }): React.ReactElement | null {
  const list = Array.isArray(evidence) ? evidence : [];
  if (list.length === 0) return null;
 
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground">
          View {list.length} source{list.length === 1 ? "" : "s"}
          <ChevronDown className="h-3.5 w-3.5 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[520px]">
        <ScrollArea className="max-h-[320px]">
          <div className="p-2 space-y-2">
            {list.map((item, idx) => (
              <div key={idx} className="rounded-md border p-2">
                <div className="text-xs text-muted-foreground">
                  {item.source}
                  {item.location ? ` • ${item.location}` : ""}
                  {typeof item.confidence === "number" ? ` • ${(item.confidence * 100).toFixed(0)}%` : ""}
                </div>
                <div className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{item.snippet}</div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
 
function containsMarkdown(text: string): boolean {
  const markdownPatterns = [
    /\*\*[^*]+\*\*/, // **bold**
    /\*[^*]+\*/, // *italic*
    /__[^_]+__/, // __bold__
    /_[^_]+_/, // _italic_
    /^#{1,6}\s/m, // headings
    /\[.+\]\(.+\)/, // links
    /^>\s/m, // blockquotes
    /^[-*]\s+\*\* /m, // - ** bold item**
    /^•\s*\*\* /m, // • ** bold item**
  ];
 
  const structuredPatterns = [
    /\*\*Actor:\*\*/i,
    /\*\*Goal:\*\*/i,
    /\*\*Scenario:\*\*/i,
    /\*\*Profile:\*\*/i,
    /\*\*Needs:\*\*/i,
    /\*\*Pain Points:\*\*/i,
    /\*\*Success Definition:\*\*/i,
  ];
 
  return markdownPatterns.some((p) => p.test(text)) || structuredPatterns.some((p) => p.test(text));
}
 
function preprocessContent(content: string): string {
  const fieldLabels = [
    "Actor",
    "Goal",
    "Scenario",
    "Profile",
    "Needs",
    "Pain Points",
    "Success Definition",
    "Responsibility",
    "Authority",
  ];
 
  let processed = content;
 
  // Add line breaks before common labels even if run together
  fieldLabels.forEach((label) => {
    const boldPattern = new RegExp(`([^\\n])\\s*\\*\\*${label}:\\*\\*`, "gi");
    processed = processed.replace(boldPattern, `$1\n\n**${label}:**`);
  });
 
  // Reduce excess blank lines
  processed = processed.replace(/\n{3,}/g, "\n\n");
 
  return processed;
}
 
function MarkdownContent({ content }: { content: string }): React.ReactElement {
  const processed = preprocessContent(content);
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="text-sm text-foreground mb-2 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="space-y-1.5 my-2 list-none pl-0">{children}</ul>,
          ol: ({ children }) => <ol className="space-y-1.5 my-2 list-decimal list-inside">{children}</ol>,
          li: ({ children }) => (
            <li className="flex items-start gap-2 text-sm text-foreground pl-0 leading-relaxed">
              <span className="text-primary mt-0.5 flex-shrink-0">•</span>
              <span className="flex-1">{children}</span>
            </li>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
 
function renderValue(value: unknown): React.ReactNode {
    // Special handling: Render 'Risks' as bullet list with bold title and mitigation below
    if (Array.isArray(value) && value.length > 0) {
      // Risks: array of objects with 'risk' and 'mitigation'
      if (value.every((risk) => typeof risk === 'object' && risk !== null && 'risk' in risk && 'mitigation' in risk)) {
        return (
          <ul className="list-disc pl-5 space-y-4">
            {value.map((riskObj: any, idx: number) => (
              <li key={idx} className="text-sm leading-relaxed">
                <div className="font-semibold">{riskObj.risk}</div>
                {riskObj.mitigation && (
                  <div className="ml-2 text-muted-foreground">{riskObj.mitigation}</div>
                )}
              </li>
            ))}
          </ul>
        );
      }
      // Key Features: array of objects with 'feature', 'priority', 'description'
      if (value.every((feat) => typeof feat === 'object' && feat !== null && 'feature' in feat)) {
        return (
          <ul className="list-disc pl-5 space-y-4">
            {value.map((featObj: any, idx: number) => (
              <li key={idx} className="text-sm leading-relaxed">
                <div className="font-semibold">
                  {featObj.feature}
                  {featObj.priority && (
                    <span className="ml-2 font-bold">({featObj.priority})</span>
                  )}
                </div>
                {featObj.description && (
                  <div className="ml-2 text-muted-foreground">{featObj.description}</div>
                )}
              </li>
            ))}
          </ul>
        );
      }
      // KPIs: array of objects with 'metric', 'baseline', 'target', 'measurement_frequency'
      if (value.every((kpi) => typeof kpi === 'object' && kpi !== null && 'metric' in kpi)) {
        return (
          <ul className="list-disc pl-5 space-y-2">
            {value.map((kpiObj: any, idx: number) => {
              const metric = kpiObj.metric || '';
              const baseline = kpiObj.baseline ? ` ${kpiObj.baseline}` : '';
              const target = kpiObj.target || '';
              const timeframe = kpiObj.timeframe || '';
              const measurement = kpiObj.measurement_frequency || '';
              // Compose the line as: Metric ... Baseline X -> Y within Z (Measurement)
              let line = metric;
              if (baseline) line += ` ... ${baseline}`;
              if (target) line += ` -> ${target}`;
              if (timeframe) line += ` within ${timeframe}`;
              if (measurement) line += ` (${measurement})`;
              return (
                <li key={idx} className="text-sm leading-relaxed">
                  {line}
                </li>
              );
            })}
          </ul>
        );
      }
      // If all are strings
      if (value.every((nfr) => typeof nfr === 'string')) {
        return (
          <ul className="list-disc pl-5 space-y-1">
            {value.map((nfr: string, idx: number) => (
              <li key={idx} className="text-sm leading-relaxed">{nfr}</li>
            ))}
          </ul>
        );
      }
      // NFR: array of objects with category and requirement, or object with category keys
      if (value.every((nfr) => typeof nfr === 'object' && nfr !== null && 'requirement' in nfr && 'category' in nfr)) {
        // Group by category
        const grouped: Record<string, string[]> = {};
        value.forEach((nfr: any) => {
          const cat = nfr.category || 'General';
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(nfr.requirement);
        });
        return (
          <div className="space-y-4">
            {Object.entries(grouped).map(([cat, points]) => (
              <div key={cat}>
                <div className="font-semibold mb-1">{cat}</div>
                <ul className="list-disc pl-5 space-y-1">
                  {points.map((pt, idx) => (
                    <li key={idx} className="text-sm leading-relaxed">{pt}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        );
      }
      // NFR: object with category keys, each containing array of points
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const categories = Object.entries(value).filter(([cat, arr]) => Array.isArray(arr) && arr.length > 0);
        if (categories.length > 0) {
          return (
            <div className="space-y-4">
              {categories.map(([cat, arr]) => (
                <div key={cat}>
                  <div className="font-semibold mb-1">{cat.replace(/:/,"")}</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {(arr as string[])
                      .flatMap((pt) => pt.split(/\s*,\s*/).filter(Boolean))
                      .map((pt, idx) => (
                        <li key={idx} className="text-sm leading-relaxed">{pt}</li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          );
        }
      }
    }
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }
 
  // Render 'Relevant Facts' as a bullet list of strings (like Assumptions)
  // Accept both array and object (legacy) for compatibility
  if (Array.isArray(value) && value.every(v => typeof v === 'string')) {
    return (
      <ul className="list-disc pl-5 space-y-1">
        {value.map((fact, idx) => (
          <li key={idx} className="text-sm leading-relaxed">{fact}</li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object" && value !== null && Object.keys(value).length > 0 && Object.keys(value).every(k => k.startsWith('additionalProp'))) {
    const facts = Object.values(value).flatMap(v => Array.isArray(v) ? v : [v]).filter(Boolean);
    return (
      <ul className="list-disc pl-5 space-y-1">
        {facts.map((fact, idx) => (
          <li key={idx} className="text-sm leading-relaxed">{stringifyInline(fact)}</li>
        ))}
      </ul>
    );
  }
 
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground">—</span>;
    }
    // Render array-of-objects as persona/use-case style cards
    const allObjects = value.every((v) => v && typeof v === "object" && !Array.isArray(v));
    if (allObjects) {
      return (
        <div className="space-y-4">
          {value.map((v, idx) => {
            const obj = v as Record<string, unknown>;
            const title =
              (typeof obj.name === "string" && obj.name) ||
              (typeof obj.title === "string" && obj.title) ||
              `Item ${idx + 1}`;
            const entries = Object.entries(obj).filter(([k]) => k !== "name" && k !== "title");
            return (
              <div key={idx} className="space-y-1">
                <div className="font-medium">{title}</div>
                <ul className="list-disc pl-5 space-y-1">
                  {entries.map(([k, val]) => (
                    <li key={k} className="text-sm leading-relaxed">
                      <span className="font-medium">{humanizeKey(k)}: </span>
                      <span className="whitespace-pre-wrap">{stringifyInline(val)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      );
    }
 
    return (
      <ul className="list-disc pl-5 space-y-1">
        {value.map((v, idx) => (
          <li key={idx} className="text-sm leading-relaxed">
            {stringifyInline(v)}
          </li>
        ))}
      </ul>
    );
  }
 
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Object.keys(obj).length === 0) {
      return <span className="text-muted-foreground">—</span>;
    }
 
    // Solution recommendation object: { value, actions? }
    if (typeof obj.value === "string") {
      const actions = Array.isArray(obj.actions) ? obj.actions : [];
      return (
        <div className="space-y-3">
          <MarkdownContent content={obj.value} />
          {actions.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Actions</div>
              <ul className="space-y-1.5">
                {actions.map((a, idx) => {
                  const actionObj = a as Record<string, unknown>;
                  const actionText =
                    typeof a === "string"
                      ? a
                      : typeof actionObj.action === "string"
                        ? actionObj.action
                        : JSON.stringify(a);
                  const priority =
                    typeof actionObj.priority === "string" ? actionObj.priority : undefined;
                  return (
                    <li key={idx} className="flex items-start gap-2 text-sm leading-relaxed">
                      <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                      <span>
                        {actionText}
                        {priority && (
                          <span className="ml-2 text-xs text-muted-foreground">({priority})</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      );
    }
 
    // Fallback: Render object as key-value pairs
    return (
      <ul className="list-disc pl-5 space-y-1">
        {Object.entries(obj).map(([k, v]) => (
          <li key={k} className="text-sm leading-relaxed">
            <span className="font-medium">{humanizeKey(k)}: </span>
            <span className="whitespace-pre-wrap">{stringifyInline(v)}</span>
          </li>
        ))}
      </ul>
    );
  }
 
  if (typeof value === "string" && containsMarkdown(value)) {
    return <MarkdownContent content={value} />;
  }
  return <p className="text-sm leading-relaxed whitespace-pre-wrap">{String(value)}</p>;
}
 
function humanizeKey(key: string): string {
  const withSpaces = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}
 
function stringifyInline(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(stringifyInline).join(", ");
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return (typeof obj.name === "string" && obj.name) || JSON.stringify(obj);
  }
  return String(value);
}
 
export interface CanvasGridProps {
  canvas: BusinessCanvas;
  onCanvasChange?: (next: BusinessCanvas) => void;
}
 
export function CanvasGrid({ canvas, onCanvasChange }: CanvasGridProps): React.ReactElement {
  const [activeFieldKey, setActiveFieldKey] = React.useState<string | null>(null);
  const [draftValue, setDraftValue] = React.useState<unknown>(null);
  const [isSaving, setIsSaving] = React.useState(false);
 
  const allConfigs = React.useMemo(
    () => [...DEFAULT_CANVAS_FIELDS].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    []
  );
 
  const headerTitle = ensureField((canvas as Record<string, unknown>).title, "string");
  const headerProblem = ensureField((canvas as Record<string, unknown>).problemStatement, "string");
  const headerSolution = ensureField((canvas as Record<string, unknown>).solutionRecommendation, "object");
 
  const openEdit = (fieldKey: string) => {
    const config = allConfigs.find((f) => f.fieldKey === fieldKey);
    const raw = (canvas as Record<string, unknown>)[fieldKey];
    const field = ensureField(raw, config?.valueType);
    setActiveFieldKey(fieldKey);
    setDraftValue(field.value);
  };
 
  const closeEdit = () => {
    setActiveFieldKey(null);
    setDraftValue(null);
    setIsSaving(false);
  };
 
  const saveEdit = async () => {
    if (!activeFieldKey) return;
    const fieldKey = activeFieldKey;
    const config = allConfigs.find((f) => f.fieldKey === fieldKey);
    const currentField = ensureField((canvas as Record<string, unknown>)[fieldKey], config?.valueType);
 
    setIsSaving(true);
    const updatedField = { ...currentField, value: draftValue } satisfies CanvasField<unknown>;
    const nextCanvas = {
      ...canvas,
      [fieldKey]: updatedField,
      updatedAt: new Date().toISOString(),
    } as BusinessCanvas;
 
    onCanvasChange?.(nextCanvas);
    closeEdit();
  };
 
  // // Add Relevant Facts to the card configs if not present
  let contentConfigs = allConfigs.filter(
    (f) => f.fieldKey !== "title" && f.fieldKey !== "problemStatement" && f.fieldKey !== "solutionRecommendation"
  );
  // // Ensure Relevant Facts is included
  // if (!contentConfigs.some(f => f.fieldKey === "relevantFacts")) {
  //   contentConfigs.push({
  //     id: "relevantFacts",
  //     name: "Relevant Facts",
  //     fieldKey: "relevantFacts",
  //     type: "default",
  //     category: "core",
  //     enabled: true,
  //     includeInGeneration: true,
  //     order: 99,
  //     valueType: "object",
  //     // instructions: "Add any facts relevant to the canvas.",
  //     description: "Relevant facts for this canvas."
  //   
 
  const handleFileUpload = (files: FileList | null) => {
    if (files) {
      console.log("Uploaded files:", files);
    }
  };
 
  return (
    <div className="space-y-4">
      {/* Header cards */}
      <div className="w-full mb-4">
        <Card className="p-5 w-full">
          <div className="space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight text-primary">
              {typeof headerTitle.value === "string" && headerTitle.value ? headerTitle.value : "Untitled Canvas"}
            </h1>
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {renderValue(headerProblem.value)}
            </div>
            <EvidenceMenu evidence={headerProblem.evidence} />
          </div>
        </Card>
 
        {/* <Card className="p-5">
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-primary">Problem Statement</h2>
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {renderValue(headerProblem.value)}
            </div>
            <EvidenceMenu evidence={headerProblem.evidence} />
          </div>
        </Card> */}
      </div>
 
      {/* Tabs bar (Canvas and BRD beside each other) */}
      <Tabs defaultValue="canvas" className="w-full">
        <div className="flex items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="canvas">Canvas</TabsTrigger>
          </TabsList>
          {/* <div className="text-xs text-muted-foreground">All fields visible (static demo)</div> */}
        </div>
 
        <TabsContent value="canvas" className="mt-4 space-y-4">
          {/* Field grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {contentConfigs.map((config) => {
              const raw = (canvas as Record<string, unknown>)[config.fieldKey];
              const field = ensureField(raw, config.valueType);
              const hasEvidence = Array.isArray(field.evidence) && field.evidence.length > 0;
 
              return (
                <Card key={config.fieldKey} className="p-4 h-80 max-h-80 flex flex-col">
                  <div className="flex items-start justify-start gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-primary truncate">{config.name}</h3>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(config.fieldKey)}
                      className="shrink-0"
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
 
                  <ScrollArea className="mt-3 flex-1 w-full">
                    <div className={cn("", typeof field.value === "object" ? "" : "")}>
                      {renderValue(field.value)}
                    </div>
                    {hasEvidence && (
                      <div className="mt-3">
                        <EvidenceMenu evidence={field.evidence} />
                      </div>
                    )}
                  </ScrollArea>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
 
      <Dialog open={!!activeFieldKey} onOpenChange={(open) => (!open ? closeEdit() : null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Edit{" "}
              {activeFieldKey
                ? allConfigs.find((f) => f.fieldKey === activeFieldKey)?.name || activeFieldKey
                : ""}
            </DialogTitle>
          </DialogHeader>
 
          {activeFieldKey ? (
            <StructuredFieldEditor
              fieldKey={activeFieldKey}
              value={(() => {
                // For 'Relevant Facts', treat as array for editing
                if (activeFieldKey === 'relevantFacts') {
                  if (Array.isArray(draftValue)) return draftValue;
                  if (typeof draftValue === 'object' && draftValue !== null) {
                    // Convert object to array of values
                    return Object.values(draftValue).flatMap(v => Array.isArray(v) ? v : [v]).filter(Boolean);
                  }
                  return [];
                }
                return draftValue;
              })()}
              onChange={(val) => {
                // For 'Relevant Facts', store as array of strings
                if (activeFieldKey === 'relevantFacts') {
                  if (Array.isArray(val)) {
                    setDraftValue(val);
                    return;
                  }
                }
                setDraftValue(val);
              }}
              onSave={saveEdit}
              onCancel={closeEdit}
              isSaving={isSaving}
            />
          ) : (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading...
            </div>
          )}
          {/* File upload removed as per user request */}
        </DialogContent>
      </Dialog>
    </div>
  );
}
 
 
 