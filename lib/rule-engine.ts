/**
 * Dynamic Rule Engine for DynamicForm
 * 
 * Provides declarative rules for field visibility, enabling, and schema modification
 * based on other field values in the form.
 */

import { getAtPath as jsonGet } from './jsonpath-lite';
import { globalSandbox } from './script-sandbox';

export interface FieldRule {
  id: string;
  description?: string;
  condition: RuleCondition;
  action: RuleAction;
  priority?: number; // Higher numbers execute first
}

export interface RuleCondition {
  type: 'and' | 'or' | 'not' | 'equals' | 'contains' | 'range' | 'exists' | 'custom';
  field?: string;     // JSONPath to field being evaluated
  value?: any;        // Expected value for comparison
  min?: number;       // For range conditions
  max?: number;
  conditions?: RuleCondition[];  // For and/or/not
  script?: string;    // For custom conditions (sandboxed)
}

export interface RuleAction {
  type: 'visibility' | 'enabled' | 'schema' | 'transform' | 'custom';
  field: string;      // JSONPath to target field
  
  // Visibility actions
  visible?: boolean;
  
  // Enabled actions  
  enabled?: boolean;
  readonly?: boolean;
  
  // Schema modification actions
  schemaUpdates?: {
    enum?: any[];     // Update enum options
    minimum?: number; // Update range constraints
    maximum?: number;
    required?: boolean;
    pattern?: string; // Update validation pattern
    format?: string;
    [key: string]: any; // Other schema properties
  };
  
  // Transform actions
  transformScript?: string; // Sandboxed script to modify field value
  
  // Custom actions
  script?: string;    // Custom sandboxed script
}

export interface RuleEvaluationResult {
  fieldStates: Record<string, FieldState>;
  schemaModifications: Record<string, any>;
  errors: RuleError[];
}

export interface FieldState {
  visible: boolean;
  enabled: boolean;
  readonly: boolean;
  schemaOverrides?: any;
  transformedValue?: any;
}

export interface RuleError {
  ruleId: string;
  message: string;
  field?: string;
}

export class RuleEngine {
  private rules: Map<string, FieldRule> = new Map();
  private rulesByField: Map<string, Set<string>> = new Map(); // field -> rule IDs
  private dependencyGraph: Map<string, Set<string>> = new Map(); // rule -> dependent rules

  constructor() {}

  /**
   * Add or update a rule
   */
  addRule(rule: FieldRule): void {
    this.rules.set(rule.id, rule);
    this.updateIndices(rule);
  }

  /**
   * Remove a rule
   */
  removeRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      this.rules.delete(ruleId);
      this.removeFromIndices(rule);
    }
  }

  /**
   * Get rules affecting a specific field (or all rules if no field specified)
   */
  getRules(fieldPath?: string): FieldRule[] {
    if (!fieldPath) {
      return Array.from(this.rules.values());
    }
    const ruleIds = this.rulesByField.get(fieldPath) || new Set();
    return Array.from(ruleIds).map(id => this.rules.get(id)!).filter(Boolean);
  }

  /**
   * Evaluate all rules against current form data
   */
  evaluateRules(formData: any, changedField?: string): RuleEvaluationResult {
    const result: RuleEvaluationResult = {
      fieldStates: {},
      schemaModifications: {},
      errors: []
    };

    // Get rules to evaluate (all rules, or just affected ones if incremental)
    const rulesToEvaluate = changedField ? 
      this.getRulesAffectedByField(changedField) : 
      Array.from(this.rules.values());

    // Sort by priority (higher first)
    rulesToEvaluate.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const rule of rulesToEvaluate) {
      try {
        const conditionMet = this.evaluateCondition(rule.condition, formData);
        if (conditionMet) {
          this.applyRuleAction(rule, formData, result);
        }
      } catch (error) {
        result.errors.push({
          ruleId: rule.id,
          message: `Rule evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
          field: rule.action.field
        });
      }
    }

    return result;
  }

  /**
   * Evaluate a single condition
   */
  evaluateCondition(condition: RuleCondition, formData: any): boolean {
    switch (condition.type) {
      case 'equals':
        if (!condition.field) return false;
        const fieldValue = jsonGet(formData, condition.field);
        return fieldValue === condition.value;

      case 'contains':
        if (!condition.field) return false;
        const containerValue = jsonGet(formData, condition.field);
        if (Array.isArray(containerValue)) {
          return containerValue.includes(condition.value);
        }
        if (typeof containerValue === 'string') {
          return containerValue.includes(String(condition.value));
        }
        return false;

      case 'range':
        if (!condition.field) return false;
        const numValue = Number(jsonGet(formData, condition.field));
        if (isNaN(numValue)) return false;
        const minOk = condition.min === undefined || numValue >= condition.min;
        const maxOk = condition.max === undefined || numValue <= condition.max;
        return minOk && maxOk;

      case 'exists':
        if (!condition.field) return false;
        const existsValue = jsonGet(formData, condition.field);
        return existsValue !== undefined && existsValue !== null && existsValue !== '';

      case 'and':
        return (condition.conditions || []).every(c => this.evaluateCondition(c, formData));

      case 'or':
        return (condition.conditions || []).some(c => this.evaluateCondition(c, formData));

      case 'not':
        return !(condition.conditions || []).every(c => this.evaluateCondition(c, formData));

      case 'custom':
        if (!condition.script) return false;
        return this.executeConditionScript(condition.script, formData, condition.field);

      default:
        return false;
    }
  }

  /**
   * Apply schema rules to modify base schema
   */
  applySchemaRules(baseSchema: any, formData: any): any {
    const evaluation = this.evaluateRules(formData);
    
    if (Object.keys(evaluation.schemaModifications).length === 0) {
      return baseSchema;
    }

    // Deep clone base schema
    const modifiedSchema = JSON.parse(JSON.stringify(baseSchema));
    
    // Apply modifications
    for (const [fieldPath, modifications] of Object.entries(evaluation.schemaModifications)) {
      this.applySchemaModification(modifiedSchema, fieldPath, modifications);
    }

    return modifiedSchema;
  }

  /**
   * Compute effective field state for a specific field
   */
  computeFieldState(fieldPath: string, formData: any): FieldState {
    const evaluation = this.evaluateRules(formData);
    return evaluation.fieldStates[fieldPath] || {
      visible: true,
      enabled: true,
      readonly: false
    };
  }

  // Private methods

  private updateIndices(rule: FieldRule): void {
    // Index by target field
    const targetField = rule.action.field;
    if (!this.rulesByField.has(targetField)) {
      this.rulesByField.set(targetField, new Set());
    }
    this.rulesByField.get(targetField)!.add(rule.id);

    // Index by condition fields for dependency tracking
    const conditionFields = this.extractConditionFields(rule.condition);
    for (const field of conditionFields) {
      if (!this.rulesByField.has(field)) {
        this.rulesByField.set(field, new Set());
      }
      this.rulesByField.get(field)!.add(rule.id);
    }
  }

  private removeFromIndices(rule: FieldRule): void {
    // Remove from all field indices
    for (const fieldRules of this.rulesByField.values()) {
      fieldRules.delete(rule.id);
    }
    
    // Clean up empty entries
    for (const [field, ruleIds] of this.rulesByField.entries()) {
      if (ruleIds.size === 0) {
        this.rulesByField.delete(field);
      }
    }
  }

  private extractConditionFields(condition: RuleCondition): string[] {
    const fields: string[] = [];
    
    if (condition.field) {
      fields.push(condition.field);
    }
    
    if (condition.conditions) {
      for (const subCondition of condition.conditions) {
        fields.push(...this.extractConditionFields(subCondition));
      }
    }
    
    return fields;
  }

  private getRulesAffectedByField(fieldPath: string): FieldRule[] {
    const affectedRuleIds = this.rulesByField.get(fieldPath) || new Set();
    return Array.from(affectedRuleIds).map(id => this.rules.get(id)!).filter(Boolean);
  }

  private applyRuleAction(rule: FieldRule, formData: any, result: RuleEvaluationResult): void {
    const targetField = rule.action.field;

    switch (rule.action.type) {
      case 'visibility':
        if (!result.fieldStates[targetField]) {
          result.fieldStates[targetField] = { visible: true, enabled: true, readonly: false };
        }
        if (rule.action.visible !== undefined) {
          result.fieldStates[targetField].visible = rule.action.visible;
        }
        break;

      case 'enabled':
        if (!result.fieldStates[targetField]) {
          result.fieldStates[targetField] = { visible: true, enabled: true, readonly: false };
        }
        if (rule.action.enabled !== undefined) {
          result.fieldStates[targetField].enabled = rule.action.enabled;
        }
        if (rule.action.readonly !== undefined) {
          result.fieldStates[targetField].readonly = rule.action.readonly;
        }
        break;

      case 'schema':
        if (rule.action.schemaUpdates) {
          if (!result.schemaModifications[targetField]) {
            result.schemaModifications[targetField] = {};
          }
          Object.assign(result.schemaModifications[targetField], rule.action.schemaUpdates);
        }
        break;

      case 'transform':
        if (rule.action.transformScript) {
          const transformedValue = this.executeTransformScript(
            rule.action.transformScript, 
            formData, 
            targetField
          );
          if (!result.fieldStates[targetField]) {
            result.fieldStates[targetField] = { visible: true, enabled: true, readonly: false };
          }
          result.fieldStates[targetField].transformedValue = transformedValue;
        }
        break;

      case 'custom':
        if (rule.action.script) {
          this.executeCustomScript(rule.action.script, formData, targetField, result);
        }
        break;
    }
  }

  private applySchemaModification(schema: any, fieldPath: string, modifications: any): void {
    // Navigate to the field in schema.properties
    const pathSegments = fieldPath.split('.');
    let current = schema;
    
    // Navigate to the parent object
    for (let i = 0; i < pathSegments.length - 1; i++) {
      const segment = pathSegments[i];
      if (!current.properties) current.properties = {};
      if (!current.properties[segment]) current.properties[segment] = { type: 'object', properties: {} };
      current = current.properties[segment];
    }
    
    // Apply modifications to the target field
    const fieldName = pathSegments[pathSegments.length - 1];
    if (!current.properties) current.properties = {};
    if (!current.properties[fieldName]) current.properties[fieldName] = {};
    
    Object.assign(current.properties[fieldName], modifications);
  }

  private executeConditionScript(script: string, formData: any, fieldPath?: string): boolean {
    try {
      const context = {
        data: formData,
        field: fieldPath ? jsonGet(formData, fieldPath) : undefined,
        utils: {
          get: (path: string) => jsonGet(formData, path),
          log: (...args: any[]) => console.log('[RuleEngine:Condition]', ...args)
        }
      };

      const result = globalSandbox.executeScript(`rule-condition-${Date.now()}`, script, context as any, { data: formData });
      return Boolean(result);
    } catch (error) {
      console.warn('[RuleEngine] Condition script failed:', error);
      return false;
    }
  }

  private executeTransformScript(script: string, formData: any, fieldPath: string): any {
    try {
      const currentValue = jsonGet(formData, fieldPath);
      const context = {
        data: formData,
        field: currentValue,
        fieldPath,
        utils: {
          get: (path: string) => jsonGet(formData, path),
          log: (...args: any[]) => console.log('[RuleEngine:Transform]', ...args)
        }
      };

      return globalSandbox.executeScript(`rule-transform-${Date.now()}`, script, context as any, { 
        data: formData, 
        currentValue 
      });
    } catch (error) {
      console.warn('[RuleEngine] Transform script failed:', error);
      return jsonGet(formData, fieldPath); // Return original value on error
    }
  }

  private executeCustomScript(script: string, formData: any, fieldPath: string, result: RuleEvaluationResult): void {
    try {
      const context = {
        data: formData,
        field: jsonGet(formData, fieldPath),
        fieldPath,
        result, // Allow script to modify result
        utils: {
          get: (path: string) => jsonGet(formData, path),
          setFieldState: (path: string, state: Partial<FieldState>) => {
            if (!result.fieldStates[path]) {
              result.fieldStates[path] = { visible: true, enabled: true, readonly: false };
            }
            Object.assign(result.fieldStates[path], state);
          },
          setSchemaModification: (path: string, modifications: any) => {
            if (!result.schemaModifications[path]) {
              result.schemaModifications[path] = {};
            }
            Object.assign(result.schemaModifications[path], modifications);
          },
          log: (...args: any[]) => console.log('[RuleEngine:Custom]', ...args)
        }
      };

      globalSandbox.executeScript(`rule-custom-${Date.now()}`, script, context as any, { 
        data: formData 
      });
    } catch (error) {
      console.warn('[RuleEngine] Custom script failed:', error);
      result.errors.push({
        ruleId: 'custom-script',
        message: `Custom script failed: ${error instanceof Error ? error.message : String(error)}`,
        field: fieldPath
      });
    }
  }
}

// Default global instance
export const globalRuleEngine = new RuleEngine();

// Helper functions for common rule patterns
export const RuleHelpers = {
  showWhen: (field: string, value: any): FieldRule => ({
    id: `show-${field}-when-${String(value)}`,
    condition: { type: 'equals', field, value },
    action: { type: 'visibility', field, visible: true }
  }),

  hideWhen: (field: string, value: any): FieldRule => ({
    id: `hide-${field}-when-${String(value)}`,
    condition: { type: 'equals', field, value },
    action: { type: 'visibility', field, visible: false }
  }),

  enableWhen: (field: string, conditionField: string, value: any): FieldRule => ({
    id: `enable-${field}-when-${conditionField}-${String(value)}`,
    condition: { type: 'equals', field: conditionField, value },
    action: { type: 'enabled', field, enabled: true }
  }),

  disableWhen: (field: string, conditionField: string, value: any): FieldRule => ({
    id: `disable-${field}-when-${conditionField}-${String(value)}`,
    condition: { type: 'equals', field: conditionField, value },
    action: { type: 'enabled', field, enabled: false }
  }),

  setEnumWhen: (field: string, enumOptions: any[], conditionField: string, value: any): FieldRule => ({
    id: `set-enum-${field}-when-${conditionField}-${String(value)}`,
    condition: { type: 'equals', field: conditionField, value },
    action: { 
      type: 'schema', 
      field, 
      schemaUpdates: { enum: enumOptions }
    }
  }),

  setRangeWhen: (field: string, min: number, max: number, conditionField: string, value: any): FieldRule => ({
    id: `set-range-${field}-when-${conditionField}-${String(value)}`,
    condition: { type: 'equals', field: conditionField, value },
    action: { 
      type: 'schema', 
      field, 
      schemaUpdates: { minimum: min, maximum: max }
    }
  })
};