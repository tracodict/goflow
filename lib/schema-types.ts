/** Schema related shared TypeScript types (Phase 0 scaffold) */

export interface StoredSchemaMeta {
  id: string;
  version: string;
  name: string;
  description?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StoredSchema extends StoredSchemaMeta {
  schema: any; // JSON Schema object (use JSONSchema7 in later phase w/ types dep)
  uiSchema?: any;
  compiledValidatorKey?: string; // reference to cache entry (phase 2+)
}

export interface CompiledValidator {
  /** Execute validation, returns boolean valid; errors accessible via getErrors */
  validate(data: any): boolean;
  /** Last validation errors (AJV-like shape) */
  getErrors(): any[] | undefined;
}

export interface SchemaRegistryApi {
  register(schema: StoredSchema): void;
  get(id: string, version?: string): StoredSchema | undefined;
  list(): StoredSchemaMeta[];
  ensureValidator(id: string, version?: string): CompiledValidator | undefined; // stub (Phase 2)
}
