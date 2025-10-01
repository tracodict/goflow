/**
 * Feature flags for phased rollout of dialog & form system.
 * Flags should be read-only at runtime except through provided override API.
 */
export type FeatureFlagKey =
  | 'ff_dialogs'
  | 'ff_dynamicForm'
  | 'ff_schemaBinding'
  | 'ff_autoSave';

export interface FeatureFlagsState {
  ff_dialogs: boolean;
  ff_dynamicForm: boolean;
  ff_schemaBinding: boolean;
  ff_autoSave: boolean;
}

const defaultFlags: FeatureFlagsState = {
  ff_dialogs: false,
  ff_dynamicForm: false,
  ff_schemaBinding: false,
  ff_autoSave: false,
};

let overrides: Partial<FeatureFlagsState> = {};

/**
 * Get merged feature flags (defaults + overrides).
 */
export function getFeatureFlags(): FeatureFlagsState {
  return { ...defaultFlags, ...overrides };
}

/**
 * Override flags (e.g., from environment, query params, or admin panel).
 * Only keys present in the input are changed.
 */
export function setFeatureFlagOverrides(next: Partial<FeatureFlagsState>) {
  overrides = { ...overrides, ...next };
}

/**
 * Reset overrides (testing / hot reload scenarios).
 */
export function resetFeatureFlagOverrides() {
  overrides = {};
}

/** Convenience helpers */
export const isDialogEnabled = () => getFeatureFlags().ff_dialogs;
export const isDynamicFormEnabled = () => getFeatureFlags().ff_dynamicForm;
export const isSchemaBindingEnabled = () => getFeatureFlags().ff_schemaBinding;
export const isAutoSaveEnabled = () => getFeatureFlags().ff_autoSave;
