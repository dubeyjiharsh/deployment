// Converts the canvas object back to the backend JSON format expected by the API
export function transformCanvasToFields(canvas: any): any {
  if (!canvas) return {};
  const fields: any = {};
  // Map each field back to the backend format using camelCase keys
  fields.id = canvas.id || "";
  fields.title = canvas.title?.value || "";
  fields.problemStatement = canvas.problemStatement?.value || "";
  fields.objectives = Array.isArray(canvas.objectives?.value) ? canvas.objectives.value : [];
  fields.kpis = Array.isArray(canvas.kpis?.value) ? canvas.kpis.value : [];
  fields.successCriteria = Array.isArray(canvas.successCriteria?.value) ? canvas.successCriteria.value : [];
  fields.keyFeatures = Array.isArray(canvas.keyFeatures?.value) ? canvas.keyFeatures.value : [];
  fields.risks = Array.isArray(canvas.risks?.value) ? canvas.risks.value : [];
  fields.assumptions = Array.isArray(canvas.assumptions?.value) ? canvas.assumptions.value : [];
  fields.nonFunctionalRequirements = canvas.nonFunctionalRequirements?.value || {};
  fields.relevantFacts = Array.isArray(canvas.relevantFacts?.value) ? canvas.relevantFacts.value : [];
  fields.useCases = Array.isArray(canvas.useCases?.value) ? canvas.useCases.value : [];
  fields.governance = canvas.governance?.value || {};
  fields.createdAt = canvas.createdAt || new Date().toISOString();
  fields.updatedAt = new Date().toISOString();
  // Add any other fields as needed
  return fields;
}
