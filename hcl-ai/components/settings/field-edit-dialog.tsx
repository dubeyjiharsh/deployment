"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import { Wand2, HelpCircle, Loader2, Upload, FileText, X, Trash2, AlertTriangle } from "lucide-react";
import type { FieldConfiguration, DisplayStyle } from "@/lib/validators/settings-schema";

/**
 * Detects format/structure instructions in generation prompt that could conflict with valueType
 * Returns array of warning messages
 */
function detectFormatInstructions(instructions: string | undefined): string[] {
  if (!instructions) return [];

  const warnings: string[] = [];
  const lowerInstructions = instructions.toLowerCase();

  // Patterns that indicate format instructions
  const formatPatterns = [
    // JSON-specific patterns
    { pattern: /return\s+(as\s+)?(a\s+)?json/i, message: "Contains 'return as JSON' - format is handled automatically" },
    { pattern: /output\s+format\s*:/i, message: "Contains 'Output Format:' section - format is handled automatically" },
    { pattern: /required\s+output\s+(format|structure)/i, message: "Contains output format specification - format is handled automatically" },
    { pattern: /```json/i, message: "Contains JSON code block - avoid embedding JSON schemas" },
    { pattern: /\{\s*"[^"]+"\s*:/i, message: "Contains JSON object structure - format is handled automatically" },
    { pattern: /\[\s*\{\s*"[^"]+"/i, message: "Contains JSON array structure - format is handled automatically" },

    // Array/list patterns
    { pattern: /return\s+an?\s+array\s+(of\s+)?(objects|items)/i, message: "Specifies 'return an array' - format is handled automatically" },
    { pattern: /each\s+(object|item)\s+(must\s+)?(contain|have|include)\s*:/i, message: "Specifies object structure - format is handled automatically" },
    { pattern: /format\s+(it|this|the\s+output)\s+(as|like)/i, message: "Contains 'format it as/like' - use Display Style setting instead" },

    // Example-following patterns
    { pattern: /follow\s+(this|the)\s+example/i, message: "Contains 'follow this example' - examples are auto-generated" },
    { pattern: /use\s+(this|the)\s+(format|structure|template)/i, message: "Contains 'use this format/structure' - format is handled automatically" },
    { pattern: /structure\s+(the\s+)?(output|response|result)\s+(as|like)/i, message: "Contains 'structure the output as' - format is handled automatically" },
    { pattern: /output\s+should\s+(be|look)\s+(like|formatted)/i, message: "Contains output formatting directive - format is handled automatically" },

    // Schema patterns
    { pattern: /schema\s*:/i, message: "Contains 'schema:' - avoid embedding schemas in instructions" },
    { pattern: /fields?\s*:\s*\[/i, message: "Contains field definitions - format is handled automatically" },
    { pattern: /must\s+(include|have|contain)\s+(the\s+)?following\s+(fields|properties)/i, message: "Specifies required fields - focus on content, not structure" },
  ];

  for (const { pattern, message } of formatPatterns) {
    if (pattern.test(instructions)) {
      warnings.push(message);
    }
  }

  // Check for explicit JSON structure definitions
  if (lowerInstructions.includes('"name":') || lowerInstructions.includes('"type":') || lowerInstructions.includes('"value":')) {
    if (!warnings.some(w => w.includes('JSON'))) {
      warnings.push("Contains JSON property names - avoid embedding schemas in instructions");
    }
  }

  return warnings;
}

/**
 * Strips format instructions from text, keeping content guidance
 */
function stripFormatInstructions(instructions: string): string {
  let cleaned = instructions;

  // Remove common format sections
  cleaned = cleaned.replace(/\*\*Output Format\*\*:?[\s\S]*?(?=\n\n\*\*|\n\n##|$)/gi, '');
  cleaned = cleaned.replace(/\*\*Required Output Structure\*\*:?[\s\S]*?(?=\n\n\*\*|\n\n##|$)/gi, '');
  cleaned = cleaned.replace(/```json[\s\S]*?```/gi, '');
  cleaned = cleaned.replace(/Return as an? (JSON )?array[\s\S]*?\./gi, '');
  cleaned = cleaned.replace(/Each (object|item) (must |should )?(contain|have|include):[\s\S]*?(?=\n\n|$)/gi, '');

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  return cleaned;
}


interface FieldEditDialogProps {
  editingField: FieldConfiguration;
  fields: FieldConfiguration[];
  isDialogOpen: boolean;
  isImprovingInstructions: boolean;
  isImprovingNegative: boolean;
  isUploadingDocument: boolean;
  uploadingFieldKey: string | null;
  onOpenChange: (open: boolean) => void;
  onChangeField: (field: FieldConfiguration) => void;
  onSaveField: () => void;
  onDeleteField: (fieldId: string) => void;
  onImproveInstructions: () => Promise<void>;
  onImproveNegativePrompt: () => Promise<void>;
  onUploadDocument: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onDeleteDocument: (documentId: string) => Promise<void>;
}

export function FieldEditDialog({
  editingField,
  fields,
  isDialogOpen,
  isImprovingInstructions,
  isImprovingNegative,
  isUploadingDocument,
  uploadingFieldKey,
  onOpenChange,
  onChangeField,
  onSaveField,
  onDeleteField,
  onImproveInstructions,
  onImproveNegativePrompt,
  onUploadDocument,
  onDeleteDocument,
}: FieldEditDialogProps): React.ReactElement {
  return (
    <Dialog open={isDialogOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingField.type === "custom" && !fields.find((f) => f.id === editingField.id)
              ? "Add Custom Field"
              : `Configure ${editingField.name}`}
          </DialogTitle>
          <DialogDescription>
            Adjust how this field behaves and what content it generates.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid gap-4">
            <h4 className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Basic Information</h4>
            <div className="space-y-2">
              <Label htmlFor="field-name">Display Name</Label>
              <Input
                id="field-name"
                value={editingField.name}
                onChange={(e) =>
                  onChangeField({ ...editingField, name: e.target.value })
                }
                placeholder="e.g. Design Specs"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="field-description">User Description</Label>
              <Input
                id="field-description"
                value={editingField.description || ""}
                onChange={(e) =>
                  onChangeField({ ...editingField, description: e.target.value })
                }
                placeholder="Brief explanation shown to users..."
              />
            </div>
          </div>

          <div className="grid gap-4">
            <h4 className="text-sm font-medium leading-none">AI Instructions</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="field-instructions">Generation Prompt</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">
                        Focus on <strong>what content</strong> to generate, not how to format it.
                        The Data Type setting handles formatting automatically.
                      </p>
                      <p className="text-xs mt-1 text-muted-foreground">
                        Good: &quot;Generate 3-5 measurable KPIs relevant to the business objectives.&quot;
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Avoid: &quot;Return as JSON array with name and value fields.&quot;
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                {editingField.instructions.trim() && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onImproveInstructions}
                    disabled={isImprovingInstructions}
                    className="h-7 px-2 text-xs"
                  >
                    {isImprovingInstructions ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {isImprovingInstructions ? "Improving..." : "Improve with AI"}
                  </Button>
                )}
              </div>
              <Textarea
                id="field-instructions"
                value={editingField.instructions}
                onChange={(e) =>
                  onChangeField({ ...editingField, instructions: e.target.value })
                }
                placeholder="Detailed instructions for the AI on what to generate..."
                className="min-h-[100px] font-mono text-sm"
                required
              />
              {/* Warning for format instructions that conflict with valueType */}
              {detectFormatInstructions(editingField.instructions).length > 0 && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <p className="font-medium mb-1">Format instructions detected - these may conflict with the Data Type setting:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {detectFormatInstructions(editingField.instructions).slice(0, 3).map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-muted-foreground">
                      Focus on <strong>what content</strong> to generate, not <strong>how to format</strong> it. The Data Type setting handles formatting.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 h-7 text-xs"
                      onClick={() => {
                        const cleaned = stripFormatInstructions(editingField.instructions);
                        onChangeField({ ...editingField, instructions: cleaned });
                      }}
                    >
                      Auto-fix: Remove format instructions
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="field-negative">Negative Prompt</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">
                        Specify what the AI should <strong>avoid</strong> when generating this field.
                        Example: &quot;Do not include generic statements, avoid technical jargon, exclude unverified claims&quot;
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                {editingField.negativePrompt?.trim() && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onImproveNegativePrompt}
                    disabled={isImprovingNegative}
                    className="h-7 px-2 text-xs"
                  >
                    {isImprovingNegative ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {isImprovingNegative ? "Improving..." : "Improve with AI"}
                  </Button>
                )}
              </div>
              <Textarea
                id="field-negative"
                value={editingField.negativePrompt || ""}
                onChange={(e) =>
                  onChangeField({ ...editingField, negativePrompt: e.target.value })
                }
                placeholder="What to avoid..."
                className="min-h-[80px] font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Behavior & Features</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <Label htmlFor="field-enabled" className="text-sm font-medium">
                    Visible
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Show this field in the canvas interface
                  </p>
                </div>
                <Switch
                  id="field-enabled"
                  checked={editingField.enabled}
                  onCheckedChange={(checked) =>
                    onChangeField({ ...editingField, enabled: checked })
                  }
                  disabled={editingField.isRequired}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <Label htmlFor="field-include-generation" className="text-sm font-medium">
                    Hide in Additional Fields Tab
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    When disabled, field will be shown in the Additional Fields section
                  </p>
                </div>
                <Switch
                  id="field-include-generation"
                  checked={editingField.includeInGeneration ?? true}
                  onCheckedChange={(checked) =>
                    onChangeField({ ...editingField, includeInGeneration: checked })
                  }
                  disabled={!editingField.enabled || editingField.isRequired}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <Label htmlFor="diagram-support" className="text-sm font-medium">
                    Diagram Support
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Enable Mermaid diagram generation
                  </p>
                </div>
                <Switch
                  id="diagram-support"
                  checked={editingField.supportsDiagram}
                  onCheckedChange={(checked) =>
                    onChangeField({ ...editingField, supportsDiagram: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <Label htmlFor="display-style" className="text-sm font-medium">
                    Display Style
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    How to render this field on the canvas
                  </p>
                </div>
                <Select
                  value={editingField.displayStyle || "auto"}
                  onValueChange={(value: DisplayStyle) => {
                    // Auto-sync valueType based on displayStyle for proper AI generation
                    // Table requires array of objects, lists work better with arrays
                    let valueType = editingField.valueType;
                    if (value === "table") {
                      valueType = "array"; // Tables need array of objects
                    } else if (value === "bullets" || value === "numbered") {
                      valueType = "array"; // Lists work better with arrays
                    } else if (value === "paragraph" || value === "comma") {
                      valueType = "string"; // Text-based styles use strings
                    }
                    // For "auto", keep current valueType
                    onChangeField({ ...editingField, displayStyle: value, valueType });
                  }}
                >
                  <SelectTrigger id="display-style" className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect</SelectItem>
                    <SelectItem value="paragraph">Paragraph</SelectItem>
                    <SelectItem value="bullets">Bullet List</SelectItem>
                    <SelectItem value="numbered">Numbered List</SelectItem>
                    <SelectItem value="comma">Comma-separated</SelectItem>
                    <SelectItem value="table">Table</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">RAG Documents</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload documents to provide field-specific context when generating this field
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    Documents uploaded here will be chunked, embedded, and retrieved specifically when the AI generates this field.
                    Useful for compliance docs, guidelines, templates, or reference materials.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="space-y-2">
              {editingField.documents && editingField.documents.length > 0 && (
                <div className="space-y-2">
                  {editingField.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 p-2.5"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{doc.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(doc.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-shrink-0"
                        onClick={() => onDeleteDocument(doc.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative">
                <input
                  type="file"
                  id="document-upload"
                  accept=".pdf,.docx,.doc,.txt,.md"
                  onChange={onUploadDocument}
                  disabled={isUploadingDocument}
                  className="sr-only"
                />
                <label htmlFor="document-upload">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full cursor-pointer"
                    disabled={isUploadingDocument}
                    asChild
                  >
                    <span>
                      {isUploadingDocument && uploadingFieldKey === editingField.fieldKey ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Document
                        </>
                      )}
                    </span>
                  </Button>
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Supported: PDF, DOCX, DOC, TXT, MD (max 10MB)
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {editingField.type === "custom" &&
            fields.find((f) => f.id === editingField.id) && (
              <Button
                variant="destructive"
                size="sm"
                className="mr-auto"
                onClick={() => {
                  onDeleteField(editingField.id);
                  onOpenChange(false);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSaveField}
            disabled={!editingField.name || !editingField.instructions}
          >
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
