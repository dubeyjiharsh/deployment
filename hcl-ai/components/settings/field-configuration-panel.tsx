"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { FieldConfiguration } from "@/lib/validators/settings-schema";
import {
  getCategoryDisplayName,
  getCategoryDescription,
  DEFAULT_CANVAS_FIELDS,
} from "@/lib/constants/default-canvas-fields";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SortableFieldItem } from "./sortable-field-item";
import { FieldEditDialog } from "./field-edit-dialog";

// Field dependencies - fields that depend on other fields
const FIELD_DEPENDENCIES: Record<string, { dependsOn: string[]; reason: string }> = {
  // OKRs are no longer required - you can generate stories from Business Requirements instead
};

interface FieldConfigurationPanelProps {
  fields: FieldConfiguration[];
  onUpdateFields: (fields: FieldConfiguration[]) => void;
  isSaving: boolean;
}

export function FieldConfigurationPanel({
  fields: initialFields,
  onUpdateFields,
  isSaving,
}: FieldConfigurationPanelProps) {
  const [fields, setFields] = React.useState<FieldConfiguration[]>(initialFields);
  const [editingField, setEditingField] = React.useState<FieldConfiguration | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState<string>("all");
  const [pendingToggle, setPendingToggle] = React.useState<{ fieldId: string; newValue: boolean } | null>(null);
  const [showDependencyWarning, setShowDependencyWarning] = React.useState(false);
  const [dependencyWarningMessage, setDependencyWarningMessage] = React.useState("");
  const [isImprovingInstructions, setIsImprovingInstructions] = React.useState(false);
  const [isImprovingNegative, setIsImprovingNegative] = React.useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = React.useState(false);
  const [uploadingFieldKey, setUploadingFieldKey] = React.useState<string | null>(null);

  const defaultValueTypeMap = React.useMemo(
    () => new Map(DEFAULT_CANVAS_FIELDS.map((field) => [field.fieldKey, field.valueType])),
    []
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  React.useEffect(() => {
    const sourceFields = initialFields.length === 0 ? DEFAULT_CANVAS_FIELDS : initialFields;
    const normalized = sourceFields.map((field) => {
      if (field.type === "custom") {
        return { ...field, valueType: field.valueType || "string" };
      }
      const defaultType = defaultValueTypeMap.get(field.fieldKey);
      return {
        ...field,
        valueType: field.valueType || defaultType || "string",
      };
    });
    setFields(normalized);
  }, [defaultValueTypeMap, initialFields]);

  const fieldsByCategory = React.useMemo(() => {
    const grouped: Record<string, FieldConfiguration[]> = {
      all: fields,
      core: [],
      planning: [],
      technical: [],
      financial: [],
      risk_stakeholders: [],
      custom: [],
    };

    fields.forEach((field) => {
      if (grouped[field.category]) {
        grouped[field.category].push(field);
      }
    });

    Object.keys(grouped).forEach((category) => {
      grouped[category].sort((a, b) => a.order - b.order);
    });

    return grouped;
  }, [fields]);

  const handleToggleField = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field || field.isRequired) return;

    const newEnabledValue = !field.enabled;

    if (!newEnabledValue && FIELD_DEPENDENCIES[field.fieldKey]) {
      const dependency = FIELD_DEPENDENCIES[field.fieldKey];
      setPendingToggle({ fieldId, newValue: newEnabledValue });
      setDependencyWarningMessage(
        `Warning: Disabling "${field.name}" will affect the following features:\n\n${dependency.reason}\n\nAre you sure you want to continue?`
      );
      setShowDependencyWarning(true);
      return;
    }

    setFields((prev) =>
      prev.map((f) =>
        f.id === fieldId ? { ...f, enabled: newEnabledValue } : f
      )
    );
  };

  const handleConfirmToggle = () => {
    if (!pendingToggle) return;

    setFields((prev) =>
      prev.map((f) =>
        f.id === pendingToggle.fieldId ? { ...f, enabled: pendingToggle.newValue } : f
      )
    );

    setShowDependencyWarning(false);
    setPendingToggle(null);
  };

  const handleCancelToggle = () => {
    setShowDependencyWarning(false);
    setPendingToggle(null);
  };

  const handleResetField = (fieldId: string): void => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field || field.type === "custom") return;

    const defaultField = DEFAULT_CANVAS_FIELDS.find((f) => f.fieldKey === field.fieldKey);
    if (!defaultField) return;

    const restored: FieldConfiguration = {
      ...defaultField,
      id: field.id, // keep stable id
      order: field.order, // preserve current placement
    };

    setFields((prev) =>
      prev.map((f) => (f.id === fieldId ? restored : f))
    );
  };

  const handleEditField = (field: FieldConfiguration) => {
    setEditingField({ ...field });
    setIsDialogOpen(true);
  };

  const handleAddCustomField = () => {
    const newField: FieldConfiguration = {
      id: nanoid(),
      name: "",
      fieldKey: "",
      type: "custom",
      category: "custom",
      enabled: true,
      includeInGeneration: true,
      order: fields.length,
      valueType: "string",
      instructions: "",
      supportsDiagram: false,
      displayStyle: "auto",
      isRequired: false,
    };
    setEditingField(newField);
    setIsDialogOpen(true);
  };

  const handleSaveField = () => {
    if (!editingField) return;

    const defaultType = defaultValueTypeMap.get(editingField.fieldKey);
    const displayStyle = editingField.displayStyle || "auto";
    const derivedValueType =
      displayStyle === "table"
        ? "array"
        : displayStyle === "bullets" || displayStyle === "numbered"
          ? "array"
          : displayStyle === "paragraph" || displayStyle === "comma"
            ? "string"
            : editingField.valueType || defaultType || "string";

    const nextField: FieldConfiguration = {
      ...editingField,
      valueType: derivedValueType,
    };

    if (!nextField.fieldKey && nextField.name) {
      nextField.fieldKey = nextField.name
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .split(/\s+/)
        .map((word, index) =>
          index === 0
            ? word.toLowerCase()
            : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join("");
    }

    setFields((prev) => {
      const existing = prev.find((f) => f.id === nextField.id);
      if (existing) {
        return prev.map((f) => (f.id === nextField.id ? nextField : f));
      } else {
        return [...prev, nextField];
      }
    });

    setIsDialogOpen(false);
    setEditingField(null);
  };

  const handleDeleteField = async (fieldId: string) => {
    // Find the field to get its documents
    const fieldToDelete = fields.find((f) => f.id === fieldId);

    // Delete all associated documents first
    if (fieldToDelete?.documents && fieldToDelete.documents.length > 0) {
      try {
        // Delete each document (this will remove chunks and metadata)
        for (const doc of fieldToDelete.documents) {
          await fetch(
            `/api/settings/field-documents?documentId=${doc.id}&fieldKey=${fieldToDelete.fieldKey}`,
            { method: "DELETE" }
          );
        }
        toast.success(`Deleted ${fieldToDelete.documents.length} document(s) associated with field`);
      } catch (error) {
        console.error("Error deleting field documents:", error);
        toast.error("Failed to delete some field documents");
      }
    }

    // Remove field from list
    setFields((prev) => prev.filter((f) => f.id !== fieldId));
  };

  const handleImproveInstructions = async () => {
    if (!editingField || !editingField.instructions.trim()) {
      toast.error("Please enter some instructions first");
      return;
    }

    setIsImprovingInstructions(true);

    try {
      const response = await fetch("/api/settings/improve-instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentInstructions: editingField.instructions,
          fieldName: editingField.name,
          valueType: editingField.valueType,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to improve instructions");
      }

      const { improvedInstructions } = await response.json();
      setEditingField({ ...editingField, instructions: improvedInstructions });
      toast.success("Instructions improved successfully");
    } catch (error) {
      console.error("Error improving instructions:", error);
      toast.error("Failed to improve instructions");
    } finally {
      setIsImprovingInstructions(false);
    }
  };

  const handleImproveNegativePrompt = async () => {
    if (!editingField || !editingField.negativePrompt?.trim()) {
      toast.error("Please enter a negative prompt first");
      return;
    }

    setIsImprovingNegative(true);

    try {
      const response = await fetch("/api/settings/improve-negative-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentNegativePrompt: editingField.negativePrompt,
          fieldName: editingField.name,
          instructions: editingField.instructions,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to improve negative prompt");
      }

      const { improvedNegativePrompt } = await response.json();
      setEditingField({ ...editingField, negativePrompt: improvedNegativePrompt });
      toast.success("Negative prompt improved");
    } catch (error) {
      console.error("Error improving negative prompt:", error);
      toast.error("Failed to improve negative prompt");
    } finally {
      setIsImprovingNegative(false);
    }
  };

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editingField) return;

    setIsUploadingDocument(true);
    setUploadingFieldKey(editingField.fieldKey);

    try {
      // First, ensure the field is saved to settings
      const fieldExists = fields.find(f => f.id === editingField.id);
      if (!fieldExists) {
        // This is a new field being created - save it first
        toast.info("Saving field configuration before uploading document...");
        const newFields = [...fields, editingField];
        setFields(newFields);

        // Save to backend and wait for completion
        await onUpdateFields(newFields);

        // Add extra buffer for Railway deployment latency
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        // Field exists, but let's ensure current editingField state is saved
        // (in case user modified instructions/etc without saving)
        const updatedFields = fields.map(f =>
          f.id === editingField.id ? editingField : f
        );

        // Save current state before uploading
        await onUpdateFields(updatedFields);

        // Wait for backend to process (especially important for Railway)
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("fieldKey", editingField.fieldKey);

      const response = await fetch("/api/settings/field-documents", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload document");
      }

      const { documentId, filename } = await response.json();

      const newDocument = {
        id: documentId,
        filename,
        uploadedAt: new Date().toISOString(),
      };

      // Update field with new document
      const updatedDocuments = editingField.documents || [];
      setEditingField({
        ...editingField,
        documents: [
          ...updatedDocuments,
          newDocument,
        ],
      });

      // Keep in-sync with the main fields state so subsequent saves don't drop the upload
      setFields((prev) =>
        prev.map((f) =>
          f.id === editingField.id
            ? {
                ...f,
                documents: [...(f.documents || []), newDocument],
              }
            : f
        )
      );

      toast.success(`Document "${filename}" uploaded and processed successfully`);
    } catch (error) {
      console.error("Error uploading document:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload document");
    } finally {
      setIsUploadingDocument(false);
      setUploadingFieldKey(null);
      // Reset file input
      event.target.value = "";
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!editingField) return;

    try {
      const response = await fetch(
        `/api/settings/field-documents?documentId=${documentId}&fieldKey=${editingField.fieldKey}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete document");
      }

      // Update field by removing document
      setEditingField({
        ...editingField,
        documents: (editingField.documents || []).filter((doc) => doc.id !== documentId),
      });

      toast.success("Document deleted successfully");
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setFields((prev) => {
      const oldIndex = prev.findIndex((f) => f.id === active.id);
      const newIndex = prev.findIndex((f) => f.id === over.id);

      const reordered = arrayMove(prev, oldIndex, newIndex);
      return reordered.map((field, idx) => ({ ...field, order: idx }));
    });
  };

  const handleApplyChanges = () => {
    onUpdateFields(fields);
  };

  const hasChanges = JSON.stringify(fields) !== JSON.stringify(initialFields);

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-lg font-medium">Fields</CardTitle>
          <CardDescription>
            Drag to reorder fields. Changes determine the structure of generated canvases.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 space-y-6">
          <div className="flex items-center gap-2 p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
            <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <p className="text-xs text-blue-900">
              Changes affect all future canvas generations. Existing canvases will hide
              disabled fields but preserve their data.
            </p>
          </div>

          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 bg-muted/50">
              <TabsTrigger value="all" className="text-xs sm:text-sm">All</TabsTrigger>
              <TabsTrigger value="core" className="text-xs sm:text-sm">Core</TabsTrigger>
              <TabsTrigger value="planning" className="text-xs sm:text-sm">Planning</TabsTrigger>
              <TabsTrigger value="technical" className="text-xs sm:text-sm">Technical</TabsTrigger>
              <TabsTrigger value="financial" className="text-xs sm:text-sm">Financial</TabsTrigger>
              <TabsTrigger value="risk_stakeholders" className="text-xs sm:text-sm">Risk</TabsTrigger>
              <TabsTrigger value="custom" className="text-xs sm:text-sm">Custom</TabsTrigger>
            </TabsList>

            {Object.entries(fieldsByCategory).map(([category, categoryFields]) => (
              <TabsContent key={category} value={category} className="space-y-4 mt-6 animate-in fade-in-50 duration-300">
                {category !== "all" && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-foreground">
                      {getCategoryDisplayName(category)}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {getCategoryDescription(category)}
                    </p>
                  </div>
                )}

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={categoryFields.map((f) => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {categoryFields.map((field) => (
                        <SortableFieldItem
                          key={field.id}
                          field={field}
                          onToggle={() => handleToggleField(field.id)}
                          onEdit={() => handleEditField(field)}
                          isSaving={isSaving}
                          onReset={() => handleResetField(field.id)}
                          canReset={field.type !== "custom"}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                {category === "custom" && (
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      onClick={handleAddCustomField}
                      disabled={isSaving}
                      className="w-full border-dashed hover:bg-accent/50 hover:border-accent-foreground/30"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Custom Field
                    </Button>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>

          {hasChanges && (
            <div className="sticky bottom-4 z-20 flex items-center justify-between p-4 bg-white border rounded-lg shadow-lg animate-in slide-in-from-bottom-4 duration-300 dark:bg-zinc-900">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm font-medium">Unsaved changes</p>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="ghost" 
                  onClick={() => setFields(initialFields)}
                  disabled={isSaving}
                  size="sm"
                >
                  Reset
                </Button>
                <Button onClick={handleApplyChanges} disabled={isSaving} size="sm">
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {editingField && (
        <FieldEditDialog
          editingField={editingField}
          fields={fields}
          isDialogOpen={isDialogOpen}
          isImprovingInstructions={isImprovingInstructions}
          isImprovingNegative={isImprovingNegative}
          isUploadingDocument={isUploadingDocument}
          uploadingFieldKey={uploadingFieldKey}
          onOpenChange={setIsDialogOpen}
          onChangeField={setEditingField}
          onSaveField={handleSaveField}
          onDeleteField={handleDeleteField}
          onImproveInstructions={handleImproveInstructions}
          onImproveNegativePrompt={handleImproveNegativePrompt}
          onUploadDocument={handleDocumentUpload}
          onDeleteDocument={handleDeleteDocument}
        />
      )}

      <AlertDialog open={showDependencyWarning} onOpenChange={setShowDependencyWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Field with Dependencies?</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {dependencyWarningMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelToggle}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmToggle}>
              Disable Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
