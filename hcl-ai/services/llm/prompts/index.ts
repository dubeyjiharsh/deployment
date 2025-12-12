/**
 * Prompts module - Re-exports all prompt building functions
 *
 * This index file provides a clean import path for prompt functions.
 * The main prompts.ts file is kept as the single source of truth to avoid
 * breaking changes, while this module structure allows for future organization.
 */

// Re-export base prompts (constants that can be used directly)
export { BASE_SYSTEM_PROMPT, INDUSTRY_GUIDANCE } from './base-prompts';

// Re-export all functions from the main prompts file
export {
  buildSystemPrompt,
  buildGenerationPrompt,
  buildRefinementPrompt,
  buildExpansionPrompt,
  buildStoriesPrompt,
  buildExecutionPrompt,
  buildConflictDetectionPrompt,
  buildBenchmarksPrompt,
  buildEpicsFromOKRsPrompt,
  buildEpicsFromBusinessRequirementPrompt,
  buildFeaturesFromEpicsPrompt,
  buildUserStoriesFromFeaturesPrompt,
} from '../prompts';
