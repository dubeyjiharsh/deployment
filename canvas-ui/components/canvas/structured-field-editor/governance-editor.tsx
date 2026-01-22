"use client";
 
/**
* GovernanceEditor
*
* Editor for governance fields with approvers and reviewers sections.
* Used for: Governance
*
* UI: Two collapsible sections, each with cards for people
*/
 
import * as React from "react";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  GOVERNANCE_CATEGORY_LABELS,
  GOVERNANCE_PERSON_FIELD_LABELS,
  type GovernanceValue,
  type GovernancePersonValue,
} from "@/lib/validators/structured-field-schemas";
import type { StructuredFieldEditorProps } from "./index";
import { API_ENDPOINTS } from '@/config/api';
import { toast } from "sonner";
 
// type GovernanceCategory = "approvers" | "reviewers" | "requirementLeads";
type GovernanceCategory = "approvers" | "reviewers";
 
/**
* Normalizes value to GovernanceValue shape
*/
function normalizeGovernance(value: unknown): GovernanceValue {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    return {
      approvers: Array.isArray(v.approvers)
        ? v.approvers.map(normalizeGovPerson)
        : [],
      reviewers: Array.isArray(v.reviewers)
        ? v.reviewers.map(normalizeGovPerson)
        : [],
      // requirementLeads: Array.isArray(v.requirementLeads)
        // ? v.requirementLeads.map(normalizeGovPerson)
        // : [],
    };
  }
  // return { approvers: [], reviewers: [], requirementLeads: [] };
  return { approvers: [], reviewers: []};
}
 
// Helper function from CanvasPreviewPage
function parseJsonIfString(v: unknown) {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch (e) {
      return v;
    }
  }
  return v;
}
 
 
function transformFieldsToCanvas(fields: any) {
  const makeField = (value: any) => ({ value: value ?? null, evidence: [], confidence: 0.5 });
 
  const parseArray = (arr: any) => {
    if (!Array.isArray(arr)) return arr ?? [];
    return arr.map((it) => parseJsonIfString(it));
  };
 
  let nfrRaw = fields["Non Functional Requirements"] || fields.non_functional_requirements || {};
  if (Array.isArray(nfrRaw)) {
    // legacy array format, try to convert
    const organized: Record<string, string[]> = {};
    nfrRaw.forEach((item: any) => {
      const cat = item.category || "General";
      const req = item.requirement || "";
      if (!organized[cat]) organized[cat] = [];
      organized[cat].push(req);
    });
    nfrRaw = organized;
  }
  // Map backend keys to frontend keys
  const { mapNfrBackendToFrontend } = require("./category-list-editor");
  const nfrFrontend = mapNfrBackendToFrontend(nfrRaw);
 
  let relevantFactsRaw = fields.RelevantFacts || fields.relevantFacts || [];
  let relevantFactsArr: string[] = Array.isArray(relevantFactsRaw)
    ? relevantFactsRaw.filter((v) => typeof v === 'string')
    : [];
 
  return {
    id: fields.canvas_id || fields.canvasId || "",
    title: makeField(fields.Title || fields.title || "Untitled Canvas"),
    problemStatement: makeField(fields.problem_statement || fields.problemStatement || fields["Problem Statement"]),
    objectives: makeField(parseArray(fields.Objectives || fields.objectives)),
    kpis: makeField(parseArray(fields.KPIs || fields.kpis)),
    successCriteria: makeField(parseArray(fields["Success Criteria"] || fields.success_criteria)),
    keyFeatures: makeField(parseArray(fields["Key Features"] || fields.key_features)),
    risks: makeField(parseArray(fields.Risks || fields.risks)),
    assumptions: makeField(parseArray(fields.Assumptions || fields.assumptions)),
    nonFunctionalRequirements: makeField(nfrFrontend),
    useCases: makeField(parseArray(fields["Use Cases"] || fields.use_cases)),
    governance: makeField(fields.Governance || fields.governance || {}),
    relevantFacts: makeField(parseArray(fields.relevantFacts || fields.relevant_facts)),
    createdAt: fields.created_at || fields.createdAt || new Date().toISOString(),
    updatedAt: fields.updated_at || fields.updatedAt || new Date().toISOString(),
  };
}
 
// Converts the frontend canvas object to the backend payload format (handles NFR and Governance/Relevant Facts)
function mapCanvasToBackendPayload(canvas: any) {
  // Get the NFR value - it should already be in the correct categorized format
  const { mapNfrFrontendToBackend } = require("./category-list-editor");
  const nfrValue = canvas.nonFunctionalRequirements?.value || {};
  let formattedNFRs: any = {};
  if (typeof nfrValue === 'object' && nfrValue !== null) {
    formattedNFRs = mapNfrFrontendToBackend(nfrValue);
  } else {
    formattedNFRs = nfrValue;
  }
  return {
    "Title": canvas.title?.value || "",
    "Problem Statement": canvas.problemStatement?.value || "",
    "Objectives": Array.isArray(canvas.objectives?.value) ? canvas.objectives.value : [],
    "KPIs": Array.isArray(canvas.kpis?.value) ? canvas.kpis.value : [],
    "Success Criteria": Array.isArray(canvas.successCriteria?.value) ? canvas.successCriteria.value : [],
    "Key Features": Array.isArray(canvas.keyFeatures?.value) ? canvas.keyFeatures.value : [],
    "Risks": Array.isArray(canvas.risks?.value) ? canvas.risks.value : [],
    "Assumptions": Array.isArray(canvas.assumptions?.value) ? canvas.assumptions.value : [],
    "Non Functional Requirements": formattedNFRs,
    "Governance": typeof canvas.governance?.value === 'object' && canvas.governance?.value !== null && !Array.isArray(canvas.governance.value)
      ? canvas.governance.value
      : {},
    "Relevant Facts": Array.isArray(canvas.relevantFacts?.value) ? canvas.relevantFacts.value : [],
    "Use Cases": Array.isArray(canvas.useCases?.value) ? canvas.useCases.value : [],
  };
}
 
 
function normalizeGovPerson(p: unknown): GovernancePersonValue {
  if (typeof p === "object" && p !== null) {
    const person = p as Record<string, unknown>;
    return {
      name: String(person.name || ""),
      role: String(person.role || ""),
      function: String(person.function || ""),
    };
  }
  return { name: "", role: "",  function: "" };
}
 
function createEmptyPerson(): GovernancePersonValue {
  return { name: "", role: "", function: "" };
}
 
export function GovernanceEditor({
  value,
  onChange,
  onSave,
  onCancel,
  isSaving,
  fieldKey,
}: StructuredFieldEditorProps & { fieldKey: keyof ReturnType<typeof transformFieldsToCanvas> }): React.ReactElement {
  const [isActuallySaving, setIsActuallySaving] = React.useState(false);
  const governance = React.useMemo(() => normalizeGovernance(value), [value]);
 
  const [expandedCategories, setExpandedCategories] = React.useState<Set<GovernanceCategory>>(
    //  new Set(["approvers", "reviewers", "requirementLeads"])
    new Set(["approvers", "reviewers"])
  );
 
  const toggleCategory = (category: GovernanceCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };
 
  const handleAddPerson = (category: GovernanceCategory) => {
    const newPerson = createEmptyPerson();
    onChange({
      ...governance,
      [category]: [...governance[category], newPerson],
    });
  };
 
  const handleUpdatePerson = (
    category: GovernanceCategory,
    index: number,
    updates: Partial<GovernancePersonValue>
  ) => {
    const newList = [...governance[category]];
    newList[index] = { ...newList[index], ...updates };
    onChange({
      ...governance,
      [category]: newList,
    });
  };
 
  const handleDeletePerson = (category: GovernanceCategory, index: number) => {
    onChange({
      ...governance,
      [category]: governance[category].filter((_, i) => i !== index),
    });
  };
 
  const handleMovePerson = (
    category: GovernanceCategory,
    fromIndex: number,
    toIndex: number
  ) => {
    const newList = [...governance[category]];
    const [removed] = newList.splice(fromIndex, 1);
    newList.splice(toIndex, 0, removed);
    onChange({
      ...governance,
      [category]: newList,
    });
  };
 
  const handleSaveChanges = async (): Promise<void> => {
    setIsActuallySaving(true);
 
    try {
      // Get canvas ID from sessionStorage
      const canvasId = sessionStorage.getItem("canvasId");
      if (!canvasId) {
        toast.error("No canvas ID found");
        return;
      }
 
      // Get the full canvas data from sessionStorage
      const canvasJsonStr = sessionStorage.getItem("canvasJson");
      if (!canvasJsonStr) {
        toast.error("No canvas data found");
        return;
      }
 
      const canvasJson = JSON.parse(canvasJsonStr);
      const canvas = transformFieldsToCanvas(canvasJson);
 
      // Update the specific field with current value
      if (canvas[fieldKey]) {
        canvas[fieldKey].value = value;
      }
 
      // Convert to backend payload format
      const payload = mapCanvasToBackendPayload(canvas);
 
      // Make the API call
      const url = API_ENDPOINTS.canvasSave(canvasId);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionStorage.getItem("authToken") || ""}`,
        },
        body: JSON.stringify(payload),
      });
 
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
 
      const data = await res.json();
 
      // Update sessionStorage with new data
      sessionStorage.setItem("canvasJson", JSON.stringify(data.fields || data));
 
      toast.success("Canvas saved successfully!");
 
      // Call the original onSave callback if provided
      if (onSave) {
        onSave();
      }
 
      // Reload the page after a short delay to show the toast
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      toast.error("Failed to save canvas");
      console.error("Failed to save canvas:", error);
    } finally {
      setIsActuallySaving(false);
    }
  };
 
 
 
  // const categories: GovernanceCategory[] = ["approvers", "reviewers", "requirementLeads"];
    const categories: GovernanceCategory[] = ["approvers", "reviewers"];
 
  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
      {categories.map((category) => {
        const people = governance[category];
        const isExpanded = expandedCategories.has(category);
        const label = GOVERNANCE_CATEGORY_LABELS[category];
 
        return (
          <Collapsible
            key={category}
            open={isExpanded}
            onOpenChange={() => toggleCategory(category)}
          >
            <Card className="border shadow-sm">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3 px-4">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      {label}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {people.length} {people.length === 1 ? "person" : "people"}
                    </span>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
 
              <CollapsibleContent>
                <CardContent className="pt-0 pb-4 px-4">
                  <div className="space-y-3">
                    {people.map((person, index) => (
                      <GovernancePersonCard
                        key={index}
                        person={person}
                        index={index}
                        totalCount={people.length}
                        onChange={(updates) => handleUpdatePerson(category, index, updates)}
                        onDelete={() => handleDeletePerson(category, index)}
                        onMoveUp={() =>
                          index > 0 && handleMovePerson(category, index, index - 1)
                        }
                        onMoveDown={() =>
                          index < people.length - 1 &&
                          handleMovePerson(category, index, index + 1)
                        }
                      />
                    ))}
 
                    {people.length === 0 && (
                      <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                        No {label.toLowerCase()} yet.
                      </div>
                    )}
 
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddPerson(category)}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {category === "approvers"
                        ? "Add Approver"
                        : category === "reviewers"
                        ? "Add Reviewer"
                        // : category === "requirementLeads"
                        // ? "Add Requirement Lead"
                        : ""}
                    </Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
 
      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t bg-background sticky bottom-0 z-10">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSaveChanges} disabled={isActuallySaving || isSaving}>
                  {isActuallySaving || isSaving ? "Saving..." : "Save Changes"}
                </Button>
      </div>
    </div>
  );
}
 
/**
* Individual governance person card
*/
interface GovernancePersonCardProps {
  person: GovernancePersonValue;
  index: number;
  totalCount: number;
  onChange: (updates: Partial<GovernancePersonValue>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}
 
function GovernancePersonCard({
  person,
  index,
  totalCount,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: GovernancePersonCardProps): React.ReactElement {
  return (
    <div className="group relative border rounded-lg p-3 bg-card hover:shadow-sm transition-shadow">
      <div className="flex gap-3">
        {/* Drag handle and move buttons */}
        <div className="flex flex-col items-center gap-1 pt-1">
          <div className="cursor-grab opacity-30 group-hover:opacity-60">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          {totalCount > 1 && (
            <div className="flex flex-col gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onMoveUp}
                disabled={index === 0}
                className="h-5 w-5"
                aria-label="Move up"
              >
                <span className="text-xs">^</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onMoveDown}
                disabled={index === totalCount - 1}
                className="h-5 w-5"
                aria-label="Move down"
              >
                <span className="text-xs rotate-180">^</span>
              </Button>
            </div>
          )}
        </div>
 
        {/* Form fields */}
        <div className="flex-1 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`name-${index}`} className="text-xs text-muted-foreground">
              {GOVERNANCE_PERSON_FIELD_LABELS.name}
            </Label>
            <Input
              id={`name-${index}`}
              value={person.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="No Names yet. Add one below"
              className="h-9"
            />
          </div>
 
          <div className="space-y-1.5">
            <Label htmlFor={`role-${index}`} className="text-xs text-muted-foreground">
              {GOVERNANCE_PERSON_FIELD_LABELS.role}
            </Label>
            <Textarea
              id={`role-${index}`}
              value={person.role}
              onChange={(e) => onChange({ role: e.target.value })}
              placeholder="No Roles yet. Add one below"
              className="min-h-[50px] resize-none text-sm"
            />
          </div>
 
          <div className="space-y-1.5">
            <Label htmlFor={`function-${index}`} className="text-xs text-muted-foreground">
              {GOVERNANCE_PERSON_FIELD_LABELS.function}
            </Label>
            <Textarea
              id={`function-${index}`}
              value={person.function}
              onChange={(e) => onChange({ function: e.target.value })}
              placeholder="No Functions yet. Add one below"
              className="min-h-[50px] resize-none text-sm"
            />
          </div>
        </div>
 
        {/* Delete button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          aria-label="Delete person"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}