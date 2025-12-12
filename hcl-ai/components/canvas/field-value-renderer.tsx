"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { DisplayStyle } from "@/lib/validators/settings-schema";

/**
 * Renders an array of items based on displayStyle
 */
function renderArrayWithStyle(items: unknown[], displayStyle: DisplayStyle): React.ReactNode {
  // Convert items to strings for simple display styles
  const stringItems = items.map(item => {
    if (typeof item === "string") return item;
    if (typeof item === "object" && item !== null) {
      const obj = item as Record<string, unknown>;
      // Find a "main" text property
      const mainKeys = ["title", "name", "description", "value", "content", "text", "summary"];
      const mainKey = mainKeys.find(k => k in obj && typeof obj[k] === "string");
      if (mainKey) return String(obj[mainKey]);
      // Fallback to first string property
      const firstStringKey = Object.keys(obj).find(k => typeof obj[k] === "string");
      if (firstStringKey) return String(obj[firstStringKey]);
      return JSON.stringify(obj);
    }
    return String(item);
  });

  switch (displayStyle) {
    case "paragraph":
      return <p className="text-sm">{stringItems.join(". ")}</p>;

    case "bullets":
      return (
        <ul className="space-y-1">
          {stringItems.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <span className="text-muted-foreground mt-1">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );

    case "numbered":
      return (
        <ol className="space-y-1">
          {stringItems.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <span className="text-muted-foreground font-medium min-w-[1.5rem]">{index + 1}.</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      );

    case "comma":
      return <p className="text-sm">{stringItems.join(", ")}</p>;

    case "table":
      // For table, we need to show the object properties
      if (items.length > 0 && typeof items[0] === "object" && items[0] !== null) {
        const firstItem = items[0] as Record<string, unknown>;
        const columns = Object.keys(firstItem).filter(k =>
          typeof firstItem[k] !== "object" || firstItem[k] === null
        );

        if (columns.length > 0) {
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    {columns.map((col) => (
                      <th key={col} className="text-left py-2 px-3 font-medium text-muted-foreground capitalize">
                        {col.replace(/([A-Z])/g, ' $1').trim()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const obj = item as Record<string, unknown>;
                    return (
                      <tr key={index} className="border-b last:border-0">
                        {columns.map((col) => (
                          <td key={col} className="py-2 px-3">
                            {String(obj[col] ?? "")}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        }
      }

      // FALLBACK: Try to parse string arrays with delimiters into table rows
      // e.g., "CDO - Approver - Strategic oversight" → {col1: "CDO", col2: "Approver", col3: "Strategic oversight"}
      if (stringItems.length > 0 && stringItems[0].includes(" - ")) {
        // Check if all items have the same number of columns
        const firstParts = stringItems[0].split(" - ").map(p => p.trim());
        const allSameColumns = stringItems.every(item =>
          item.split(" - ").length === firstParts.length
        );

        if (allSameColumns && firstParts.length >= 2) {
          // Generate generic column headers based on position
          const columnHeaders = firstParts.length === 3
            ? ["Name/Role", "Type", "Description"]
            : firstParts.length === 2
            ? ["Item", "Details"]
            : firstParts.map((_, i) => `Column ${i + 1}`);

          return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    {columnHeaders.map((header, i) => (
                      <th key={i} className="text-left py-2 px-3 font-medium text-muted-foreground">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stringItems.map((item, index) => {
                    const parts = item.split(" - ").map(p => p.trim());
                    return (
                      <tr key={index} className="border-b last:border-0">
                        {parts.map((part, i) => (
                          <td key={i} className="py-2 px-3">
                            {part}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        }
      }

      // Final fallback to bullets if not suitable for table
      return (
        <ul className="space-y-1">
          {stringItems.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <span className="text-muted-foreground mt-1">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );

    default: // "auto" - return null to use default rendering
      return null;
  }
}

/**
 * Splits a string into items using various delimiters
 * Handles: newlines, semicolons, and period-separated sentences
 */
function splitStringIntoItems(value: string): string[] {
  // Priority 1: Split by newlines if present
  if (value.includes("\n")) {
    return value.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
  }

  // Priority 2: Split by semicolons (common in AI-generated lists)
  if (value.includes(";")) {
    return value.split(/;\s*/).map(l => l.trim()).filter(l => l.length > 0);
  }

  // Priority 3: Split by periods followed by capital letters (sentence boundaries)
  // But only if there are multiple sentences
  const sentenceMatches = value.match(/[^.!?]+[.!?]+/g);
  if (sentenceMatches && sentenceMatches.length > 2) {
    return sentenceMatches.map(s => s.trim()).filter(s => s.length > 0);
  }

  // No suitable delimiter found - return as single item
  return [value];
}

/**
 * Renders a string value based on displayStyle
 */
function renderStringWithStyle(value: string, displayStyle: DisplayStyle): React.ReactNode {
  const hasNumberedList = /^\d+\.\s/m.test(value);
  const hasBullets = /^[-•*]\s/m.test(value);

  if (displayStyle === "auto") {
    // Auto-detect based on content
    if (hasNumberedList) {
      const items = value.split(/\n/).filter(l => l.trim());
      return (
        <ol className="space-y-1">
          {items.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <span className="text-muted-foreground font-medium min-w-[1.5rem]">{index + 1}.</span>
              <span>{item.replace(/^\d+\.\s*/, "")}</span>
            </li>
          ))}
        </ol>
      );
    }
    if (hasBullets) {
      const items = value.split(/\n/).filter(l => l.trim());
      return (
        <ul className="space-y-1">
          {items.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <span className="text-muted-foreground mt-1">•</span>
              <span>{item.replace(/^[-•*]\s*/, "")}</span>
            </li>
          ))}
        </ul>
      );
    }
    // Default to paragraph
    return <p className="text-sm whitespace-pre-wrap">{value}</p>;
  }

  // Force specific style - use smart splitting
  const items = splitStringIntoItems(value);

  if (displayStyle === "bullets") {
    if (items.length > 1) {
      return (
        <ul className="space-y-1">
          {items.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <span className="text-muted-foreground mt-1">•</span>
              <span>{item.replace(/^[-•*\d.]\s*/, "")}</span>
            </li>
          ))}
        </ul>
      );
    }
    // Single item - still show as bullet
    return (
      <ul className="space-y-1">
        <li className="flex items-start gap-2 text-sm">
          <span className="text-muted-foreground mt-1">•</span>
          <span>{value}</span>
        </li>
      </ul>
    );
  }

  if (displayStyle === "numbered") {
    if (items.length > 1) {
      return (
        <ol className="space-y-1">
          {items.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <span className="text-muted-foreground font-medium min-w-[1.5rem]">{index + 1}.</span>
              <span>{item.replace(/^[-•*\d.]\s*/, "")}</span>
            </li>
          ))}
        </ol>
      );
    }
    return (
      <ol className="space-y-1">
        <li className="flex items-start gap-2 text-sm">
          <span className="text-muted-foreground font-medium min-w-[1.5rem]">1.</span>
          <span>{value}</span>
        </li>
      </ol>
    );
  }

  if (displayStyle === "comma") {
    if (items.length > 1) {
      return <p className="text-sm">{items.join(", ")}</p>;
    }
  }

  return <p className="text-sm whitespace-pre-wrap">{value}</p>;
}

/**
 * Renders field values with explicit display style
 * Use this when you have access to field configuration
 */
export function renderFieldValueWithStyle(value: unknown, displayStyle: DisplayStyle = "auto"): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground italic">Not specified</span>;
  }

  // Handle strings with style
  if (typeof value === "string") {
    return renderStringWithStyle(value, displayStyle);
  }

  // Handle arrays
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground italic">None</span>;
    }

    // Try styled rendering first (unless auto)
    if (displayStyle !== "auto") {
      const styledResult = renderArrayWithStyle(value, displayStyle);
      if (styledResult) return styledResult;
    }

    // Fall back to auto-detected complex rendering
    return renderFieldValue(value);
  }

  // For objects, use default rendering
  return renderFieldValue(value);
}

/**
 * Renders field values based on their type (string, array, object)
 * Supports stakeholders, success criteria, architecture components, OKRs,
 * budgets, change management, ROI, timelines, and more
 */
export function renderFieldValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground italic">Not specified</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground italic">None</span>;
    }

    // Check if array contains stakeholder objects (must have name, role, influence, interest)
    if (value.length > 0 && value[0] && typeof value[0] === "object" &&
        "name" in value[0] && "role" in value[0] && "influence" in value[0] && "interest" in value[0]) {
      return (
        <div className="space-y-3">
          {value.map((stakeholder: {
            name: string;
            role: string;
            influence: string;
            interest: string;
            raciRole?: string;
          }, index) => (
            <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border">
              <div className="flex-1">
                <p className="font-medium text-sm">{stakeholder.name}</p>
                <p className="text-xs text-muted-foreground">{stakeholder.role}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    Influence: {stakeholder.influence}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Interest: {stakeholder.interest}
                  </Badge>
                  {stakeholder.raciRole && (
                    <Badge variant="secondary" className="text-xs uppercase">
                      {stakeholder.raciRole}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Check if array contains success criteria objects
    if (value.length > 0 && value[0] && typeof value[0] === "object" && "metric" in value[0]) {
      return (
        <div className="space-y-2">
          {value.map((criteria: {
            metric: string;
            target: string;
            measurement?: string;
          }, index) => (
            <div key={index} className="p-3 rounded-lg bg-muted/30 border">
              <p className="font-medium text-sm">{criteria.metric}</p>
              <p className="text-xs text-muted-foreground mt-1">Target: {criteria.target}</p>
              {criteria.measurement && (
                <p className="text-xs text-muted-foreground">Measurement: {criteria.measurement}</p>
              )}
            </div>
          ))}
        </div>
      );
    }

    // Check if array contains architecture components
    if (value.length > 0 && value[0] && typeof value[0] === "object" && "layer" in value[0]) {
      return (
        <div className="space-y-2">
          {value.map((component: {
            layer: string;
            components: string[];
            description?: string;
          }, index) => (
            <div key={index} className="p-3 rounded-lg bg-muted/30 border">
              <p className="font-medium text-sm">{component.layer}</p>
              <ul className="list-disc list-inside text-xs text-muted-foreground mt-1">
                {component.components.map((comp, idx) => (
                  <li key={idx}>{comp}</li>
                ))}
              </ul>
              {component.description && (
                <p className="text-xs text-muted-foreground mt-1">{component.description}</p>
              )}
            </div>
          ))}
        </div>
      );
    }

    // Check if array contains OKRs
    if (value.length > 0 && value[0] && typeof value[0] === "object" && "type" in value[0] &&
        (value[0].type === "objective" || value[0].type === "key-result")) {
      const okrs = value as Array<{
        id: string;
        type: "objective" | "key-result";
        title: string;
        description: string;
        targetValue?: string;
        currentValue?: string;
        parentId?: string;
        dueDate?: string;
        owner?: string;
      }>;

      // Separate objectives and key results
      const objectives = okrs.filter(okr => okr.type === "objective");

      return (
        <div className="space-y-4">
          {objectives.map((objective, index) => {
            // Find key results for this objective
            const objectiveId = objective.id || `obj-${index}`;
            const keyResults = okrs.filter(
              kr => kr.type === "key-result" && kr.parentId === objectiveId
            );

            return (
              <div key={objectiveId} className="border rounded-lg p-4 bg-muted/20">
                <div className="mb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-1">
                      <Badge variant="default" className="text-xs">OBJECTIVE</Badge>
                      <h4 className="font-semibold text-sm">{objective.title}</h4>
                    </div>
                    {objective.dueDate && (
                      <Badge variant="outline" className="text-xs">
                        {new Date(objective.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{objective.description}</p>
                  {objective.owner && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Owner: <span className="font-medium">{objective.owner}</span>
                    </p>
                  )}
                </div>

                {keyResults.length > 0 && (
                  <div className="space-y-2 pl-3 border-l-2 border-primary/30">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Key Results ({keyResults.length})
                    </p>
                    {keyResults.map((kr, krIndex) => (
                      <div
                        key={kr.id || `kr-${objectiveId}-${krIndex}`}
                        className="p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h5 className="font-medium text-xs flex-1">{kr.title}</h5>
                          {kr.targetValue && (
                            <Badge variant="outline" className="text-xs">
                              Target: {kr.targetValue}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{kr.description}</p>
                        {(kr.currentValue || kr.dueDate) && (
                          <div className="flex items-center gap-3 text-xs">
                            {kr.currentValue && (
                              <div>
                                <span className="text-muted-foreground">Current:</span>{" "}
                                <span className="font-medium">{kr.currentValue}</span>
                              </div>
                            )}
                            {kr.dueDate && (
                              <div>
                                <span className="text-muted-foreground">Due:</span>{" "}
                                <span className="font-medium">{new Date(kr.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    // Check for scope-like structure: [{category: "In-Scope", items: [...]}]
    if (value.length > 0 && value[0] && typeof value[0] === "object" && "category" in value[0] && "items" in value[0]) {
      return (
        <div className="space-y-4">
          {value.map((section: { category: string; items: string[] }, index) => (
            <div key={index}>
              <p className="font-medium text-sm mb-2">{section.category}</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {Array.isArray(section.items) && section.items.map((item, idx) => (
                  <li key={idx}>{String(item)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    }

    // Check for governance-like structure: [{Role, Type, Responsibility}]
    if (value.length > 0 && value[0] && typeof value[0] === "object" && "Role" in value[0] && "Responsibility" in value[0]) {
      return (
        <div className="space-y-2">
          {value.map((person: { Role: string; Type?: string; Name?: string; Responsibility: string }, index) => (
            <div key={index} className="p-3 rounded-lg bg-muted/30 border">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium text-sm">{person.Role}</p>
                {person.Type && (
                  <Badge variant={person.Type === "Approver" ? "default" : "outline"} className="text-xs">
                    {person.Type}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{person.Responsibility}</p>
              {person.Name && <p className="text-xs text-muted-foreground mt-1">Name: {person.Name}</p>}
            </div>
          ))}
        </div>
      );
    }

    // Check for dependency-like structure: [{dependency, type, classification, owner, impact}]
    if (value.length > 0 && value[0] && typeof value[0] === "object" && "dependency" in value[0] && "owner" in value[0]) {
      return (
        <div className="space-y-2">
          {value.map((dep: { dependency: string; type?: string; classification?: string; owner: string; impact?: string }, index) => (
            <div key={index} className="p-3 rounded-lg bg-muted/30 border">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-medium text-sm flex-1">{dep.dependency}</p>
                <div className="flex gap-1 flex-shrink-0">
                  {dep.type && (
                    <Badge variant="outline" className="text-xs">
                      {dep.type}
                    </Badge>
                  )}
                  {dep.classification && (
                    <Badge variant={dep.classification === "Blocking" ? "destructive" : "secondary"} className="text-xs">
                      {dep.classification}
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Owner: {dep.owner}</p>
              {dep.impact && <p className="text-xs text-muted-foreground mt-1">{dep.impact}</p>}
            </div>
          ))}
        </div>
      );
    }

    // Default array rendering - handle both strings and objects
    return (
      <div className="space-y-2">
        {value.map((item, index) => {
          // If item is an object, render as a card with main text + metadata
          if (typeof item === "object" && item !== null) {
            const obj = item as Record<string, unknown>;
            const keys = Object.keys(obj);

            // Find the "main" property (longest string value, or common names)
            const mainKeys = ["title", "name", "description", "dependency", "value", "content", "text", "summary"];
            let mainKey = mainKeys.find(k => k in obj && typeof obj[k] === "string");

            // If no common key found, use the first long string property
            if (!mainKey) {
              mainKey = keys.find(k => typeof obj[k] === "string" && String(obj[k]).length > 20);
            }
            if (!mainKey && keys.length > 0) {
              mainKey = keys[0];
            }

            const mainValue = mainKey ? String(obj[mainKey]) : "";
            const metaKeys = keys.filter(k => k !== mainKey);

            // Simple list item for objects with just one meaningful property
            if (metaKeys.length === 0 || (metaKeys.length === 1 && !obj[metaKeys[0]])) {
              return <div key={index} className="flex items-start gap-2"><span className="text-muted-foreground">•</span><span>{mainValue}</span></div>;
            }

            // Card layout for objects with metadata
            return (
              <div key={index} className="p-3 rounded-lg bg-muted/30 border">
                <p className="font-medium text-sm mb-1">{mainValue}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {metaKeys.map((key) => {
                    const val = obj[key];
                    if (!val) return null;
                    return (
                      <span key={key}>
                        <span className="capitalize">{key}:</span> {String(val)}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          }
          return <div key={index} className="flex items-start gap-2"><span className="text-muted-foreground">•</span><span>{String(item)}</span></div>;
        })}
      </div>
    );
  }

  if (typeof value === "object" && value !== null) {
    // Check if this is a budget object
    if ("totalEstimate" in value || "breakdown" in value) {
      const budget = value as {
        totalEstimate?: string;
        breakdown?: Array<{ category: string; amount: string; notes?: string }>;
        resourceRequirements?: string[];
        fteRequirements?: string;
      };
      return (
        <div className="space-y-3">
          {budget.totalEstimate && (
            <div className="p-3 rounded-lg bg-primary/5 border">
              <p className="text-xs text-muted-foreground">Total Estimate</p>
              <p className="font-medium text-sm mt-1">{budget.totalEstimate}</p>
            </div>
          )}
          {budget.fteRequirements && (
            <div className="p-3 rounded-lg bg-primary/5 border">
              <p className="text-xs text-muted-foreground">FTE Requirements</p>
              <p className="font-medium text-sm mt-1">{budget.fteRequirements}</p>
            </div>
          )}
          {budget.breakdown && budget.breakdown.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Budget Breakdown</p>
              {budget.breakdown.map((item, index) => (
                <div key={index} className="p-3 rounded-lg bg-muted/30 border">
                  <div className="flex justify-between items-center">
                    <p className="font-medium text-sm">{item.category}</p>
                    <Badge variant="outline">{item.amount}</Badge>
                  </div>
                  {item.notes && (
                    <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {budget.resourceRequirements && budget.resourceRequirements.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Resource Requirements</p>
              <ul className="list-disc list-inside space-y-1">
                {budget.resourceRequirements.map((req, index) => (
                  <li key={index}>{req}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    // Check if this is a change management object
    if ("trainingNeeds" in value || "communicationPlan" in value) {
      const changeManagement = value as {
        trainingNeeds?: string[];
        communicationPlan?: string;
        adoptionStrategy?: string;
        resistanceMitigation?: string[];
      };
      return (
        <div className="space-y-3">
          {changeManagement.adoptionStrategy && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Adoption Strategy</p>
              <p className="text-sm">{changeManagement.adoptionStrategy}</p>
            </div>
          )}
          {changeManagement.communicationPlan && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Communication Plan</p>
              <p className="text-sm">{changeManagement.communicationPlan}</p>
            </div>
          )}
          {changeManagement.trainingNeeds && changeManagement.trainingNeeds.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Training Needs</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                {changeManagement.trainingNeeds.map((need, index) => (
                  <li key={index}>{need}</li>
                ))}
              </ul>
            </div>
          )}
          {changeManagement.resistanceMitigation && changeManagement.resistanceMitigation.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Resistance Mitigation</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                {changeManagement.resistanceMitigation.map((mitigation, index) => (
                  <li key={index}>{mitigation}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    // Check if this is an ROI object
    if ("expectedReturn" in value || "paybackPeriod" in value) {
      const roi = value as {
        expectedReturn?: string;
        paybackPeriod?: string;
        costBenefit?: string;
        financialJustification?: string;
      };
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {roi.expectedReturn && (
              <div className="p-3 rounded-lg bg-primary/5 border">
                <p className="text-xs text-muted-foreground">Expected Return</p>
                <p className="font-medium text-sm mt-1">{roi.expectedReturn}</p>
              </div>
            )}
            {roi.paybackPeriod && (
              <div className="p-3 rounded-lg bg-primary/5 border">
                <p className="text-xs text-muted-foreground">Payback Period</p>
                <p className="font-medium text-sm mt-1">{roi.paybackPeriod}</p>
              </div>
            )}
          </div>
          {roi.costBenefit && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Cost-Benefit Analysis</p>
              <p className="text-sm">{roi.costBenefit}</p>
            </div>
          )}
          {roi.financialJustification && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Financial Justification</p>
              <p className="text-sm">{roi.financialJustification}</p>
            </div>
          )}
        </div>
      );
    }

    // Check if this is a timeline object
    if ("start" in value && "end" in value && "milestones" in value) {
      const timeline = value as { start: string | null; end: string | null; milestones: Array<{name: string; date?: string; description?: string}> };
      return (
        <div className="space-y-4">
          {(timeline.start || timeline.end) && (
            <div className="flex items-center gap-4 text-sm">
              {timeline.start && (
                <div>
                  <span className="text-muted-foreground">Start:</span>{" "}
                  <span className="font-medium">{timeline.start}</span>
                </div>
              )}
              {timeline.end && (
                <div>
                  <span className="text-muted-foreground">End:</span>{" "}
                  <span className="font-medium">{timeline.end}</span>
                </div>
              )}
            </div>
          )}
          {timeline.milestones && timeline.milestones.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Milestones</p>
              <div className="space-y-4">
                {timeline.milestones.map((milestone, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                    <div className="space-y-1 flex-1">
                      {milestone.date && (
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {(() => {
                            try {
                              const date = new Date(milestone.date);
                              return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                            } catch {
                              return milestone.date;
                            }
                          })()}
                        </p>
                      )}
                      <p className="font-medium text-sm">{milestone.name}</p>
                      {milestone.description && (
                        <p className="text-sm text-muted-foreground">{milestone.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Check if this is a technical architecture object (with categories like frontend, backend, etc.)
    if ("frontend" in value || "backend" in value || "integrations" in value || "infrastructure" in value) {
      const architecture = value as {
        frontend?: string[];
        backend?: string[];
        integrations?: string[];
        infrastructure?: string[];
        [key: string]: string[] | undefined;
      };

      return (
        <div className="space-y-2">
          {Object.entries(architecture).map(([category, items], index) => (
            items && items.length > 0 && (
              <div key={index} className="p-3 rounded-lg bg-muted/30 border">
                <p className="font-medium text-sm capitalize mb-2">{category}</p>
                <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                  {items.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )
          ))}
        </div>
      );
    }

    // Fallback for other objects
    return <pre className="text-xs">{JSON.stringify(value, null, 2)}</pre>;
  }

  return <p>{String(value)}</p>;
}
