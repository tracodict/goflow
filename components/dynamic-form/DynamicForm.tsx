"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import Ajv, { ErrorObject } from 'ajv';
import { schemaRegistry } from '@/lib/schema-registry';
import { fetchPreSupportedSchema } from '@/components/petri/pre-supported-schemas';
import { useSystemSettings } from '@/components/petri/system-settings-context';
import { getAtPath as jsonGet, setAtPath as jsonSet } from '@/lib/jsonpath-lite';
import { globalRuleEngine, type FieldRule, type FieldState } from '@/lib/rule-engine';

export interface DynamicFormProps {
  schemaId: string;
  schemaVersion?: string;
  value?: any;
  /** Optional external model object for field bindings */
  model?: any;
  /** Map of form field (dot path relative to root) -> JSONPath in external model */
  bindings?: Record<string, string>;
  /** UI schema controlling order and widgets */
  uiSchema?: {
    ['ui:order']?: string[];
    [field: string]: any;
  };
  /** Dynamic rules for field visibility, enabling, and schema modification */
  rules?: FieldRule[];
  /** Unique component instance id (for event payload context) */
  componentId?: string;
  /** Optional event emitter bridge (eventName, payload) -> void */
  emitEvent?: (eventName: string, payload: any) => void;
  readOnly?: boolean;
  layout?: 'auto' | 'custom-page' | 'vertical-table';
  onChange?: (data: any) => void;
  onSubmit?: (data: any) => void;
  onValidate?: (valid: boolean, errors?: ErrorObject[] | null) => void;
  /** Emitted when a bound field writes to the external model */
  onModelChange?: (model: any) => void;
  className?: string;
}

const ajv = new Ajv({ allErrors: true, strict: false });

export const DynamicForm: React.FC<DynamicFormProps> = ({
  schemaId,
  schemaVersion,
  value,
  model,
  bindings,
  uiSchema,
  rules,
  componentId,
  emitEvent,
  readOnly,
  layout = 'auto',
  onChange,
  onSubmit,
  onValidate,
  onModelChange,
  className,
}) => {
  // Access system settings (for dictionaryUrl) to attempt auto-fetch of known schemas
  let dictionaryUrl: string | undefined;
  try {
    // Hook only valid in React component tree; wrap in try in case this component gets used outside provider (defensive)
    const settingsCtx = useSystemSettings();
    dictionaryUrl = settingsCtx?.settings?.dictionaryUrl;
  } catch {
    // ignore
  }
  // Force re-render when schema is fetched and registered
  const [schemaFetchTrigger, setSchemaFetchTrigger] = useState(0);
  const stored = useMemo(() => schemaRegistry.get(schemaId, schemaVersion), [schemaId, schemaVersion, schemaFetchTrigger]);
  const schemaMissing = !stored;
  const jsonSchema = stored?.schema || { type: 'object', properties: {} };
  const [data, setData] = useState<any>(() => value ?? {});
  const [errors, setErrors] = useState<ErrorObject[] | null>(null);
  const [isDirty, setDirty] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  // Rule engine state
  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>({});
  const [ruleEvaluationId, setRuleEvaluationId] = useState(0);
  // Track open accordions for nested objects/arrays in auto layout mode
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(() => new Set());
  const toggleAccordion = (path: string, force?: boolean) => {
    setOpenAccordions(prev => {
      const next = new Set(prev);
      const willOpen = force !== undefined ? force : !next.has(path);
      if (willOpen) next.add(path); else next.delete(path);
      return next;
    });
  };

  // Setup rules when component mounts or rules change
  useEffect(() => {
    if (rules && rules.length > 0) {
      // Clear existing rules for this form instance
      globalRuleEngine.getRules().forEach(rule => {
        if (rule.id.startsWith(`${schemaId}-`)) {
          globalRuleEngine.removeRule(rule.id);
        }
      });
      
      // Add new rules with form-specific prefixes
      rules.forEach(rule => {
        globalRuleEngine.addRule({
          ...rule,
          id: `${schemaId}-${rule.id}`
        });
      });
      
      // Force rule re-evaluation
      setRuleEvaluationId(prev => prev + 1);
    }
  }, [rules, schemaId]);

  // Evaluate rules when data or rule evaluation is triggered
  useEffect(() => {
    if (rules && rules.length > 0) {
      const evaluation = globalRuleEngine.evaluateRules(data);
      setFieldStates(evaluation.fieldStates);
      
      if (evaluation.errors.length > 0) {
        console.warn('[DynamicForm] Rule evaluation errors:', evaluation.errors);
      }
    }
  }, [data, rules, ruleEvaluationId]);

  // Compile schema (very naive; later phases should cache)
  const validator = useMemo(() => {
    try {
      return ajv.compile(jsonSchema);
    } catch (e) {
      console.warn('Failed to compile schema', e);
      return undefined;
    }
  }, [jsonSchema]);

  // Validate when data changes
  useEffect(() => {
    if (!validator) return;
    const valid = validator(data);
    const errs = (validator.errors as ErrorObject[] | null) || null;
    setErrors(errs);
    onValidate?.(!!valid, errs);
    setIsValid(!!valid);
    if (emitEvent && componentId) {
      emitEvent('onValidate', {
        timestamp: Date.now(),
        componentId,
        eventType: 'onValidate',
        valid: !!valid,
        errors: errs
      });
    }
  }, [data, validator]);

  // Reset when schema identity changes (uncontrolled mode)
  useEffect(() => {
    setData(value ?? {});
    setDirty(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaId, schemaVersion]);

  // External controlled value sync (overrides bindings when provided)
  useEffect(() => {
    if (value !== undefined) setData(value);
  }, [value]);

  // Apply bindings from external model when model or bindings change and component is uncontrolled by value
  useEffect(() => {
    if (value !== undefined) return; // skip if controlled
    if (!bindings || !model) return;
    let next = data;
    Object.entries(bindings).forEach(([formPath, jsonPath]) => {
      try {
        const v = jsonGet(model, jsonPath);
        if (v !== undefined) {
          // set via dot path logic; reuse updateAtPath style immutability locally
          if (!formPath.includes('.')) {
            next = { ...next, [formPath]: v };
          } else {
            const segs = formPath.split('.');
            const clone = Array.isArray(next) ? [...next] : { ...next };
            let cursor: any = clone;
            for (let i = 0; i < segs.length - 1; i++) {
              const k = segs[i];
              cursor[k] = cursor[k] !== undefined ? (Array.isArray(cursor[k]) ? [...cursor[k]] : { ...cursor[k] }) : {};
              cursor = cursor[k];
            }
            cursor[segs[segs.length - 1]] = v;
            next = clone;
          }
        }
      } catch (e) {
        console.warn('Binding read failed', formPath, jsonPath, e);
      }
    });
    setData(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, bindings]);

  // Attempt auto-fetch & register pre-supported schema if missing
  useEffect(() => {
    let cancelled = false;
    // Debounce to avoid flooding fetches while user is typing schema ID
    const handle = setTimeout(() => {
      (async () => {
        if (!schemaMissing || !schemaId) return;
        if (!dictionaryUrl) return;
        try {
          const fetched = await fetchPreSupportedSchema(schemaId, dictionaryUrl);
          if (cancelled) return;
          if (fetched && typeof fetched === 'object') {
            const version = (fetched as any).version || '1.0.0';
            schemaRegistry.register({
              id: schemaId,
              version,
              name: fetched.title || schemaId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              schema: fetched
            } as any);
            // Force component re-render now that schema is available
            setSchemaFetchTrigger(prev => prev + 1);
          }
        } catch (e) {
          console.warn('[DynamicForm] auto-fetch schema failed', schemaId, e);
        }
      })();
    }, 500); // 500ms debounce window
    return () => { cancelled = true; clearTimeout(handle); };
  }, [schemaMissing, schemaId, dictionaryUrl]);

  const setDataAndEmit = (next: any, meta?: { path?: string; value?: any }) => {
    setData(next);
    setDirty(true);
    onChange?.(next);
    
    // Trigger rule re-evaluation when data changes
    if (rules && rules.length > 0 && meta?.path) {
      // Use setTimeout to batch rapid changes
      setTimeout(() => {
        const evaluation = globalRuleEngine.evaluateRules(next, meta.path);
        setFieldStates(evaluation.fieldStates);
      }, 0);
    }
    
    if (emitEvent && componentId && meta?.path) {
      emitEvent('onChange', {
        timestamp: Date.now(),
        componentId,
        eventType: 'onChange',
        path: meta.path,
        value: meta.value,
        fullData: next
      });
    }
  };

  const updateAtPath = (path: string, val: any) => {
    let next;
    if (!path.includes('.')) {
      next = { ...data, [path]: val };
    } else {
      const segs = path.split('.');
      next = Array.isArray(data) ? [...data] : { ...data };
      let cursor: any = next;
      for (let i = 0; i < segs.length - 1; i++) {
        const k = segs[i];
        cursor[k] = cursor[k] !== undefined ? (Array.isArray(cursor[k]) ? [...cursor[k]] : { ...cursor[k] }) : {};
        cursor = cursor[k];
      }
      cursor[segs[segs.length - 1]] = val;
    }
    setDataAndEmit(next, { path, value: val });
    if (bindings && bindings[path] && model !== undefined) {
      try {
        const newModel = jsonSet(model, bindings[path], val);
        onModelChange?.(newModel);
      } catch (e) {
        console.warn('Binding write failed', path, bindings[path], e);
      }
    }
  };

  const ensurePath = (path: string, init: any) => {
    if (!path) return;
    const segs = path.split('.');
    const clone = Array.isArray(data) ? [...data] : { ...data };
    let cursor: any = clone;
    for (let i = 0; i < segs.length; i++) {
      const k = segs[i];
      if (cursor[k] === undefined) cursor[k] = i === segs.length - 1 ? init : {};
      cursor = cursor[k];
    }
    setDataAndEmit(clone, { path, value: init });
  };

  const removeArrayIndex = (path: string, index: number) => {
    const target = getValue(path);
    if (!Array.isArray(target)) return;
    const nextArr = target.filter((_, i) => i !== index);
    updateAtPath(path, nextArr);
  };

  const getValue = (path: string) => {
    if (!path) return data;
    const segs = path.split('.');
    let cursor: any = data;
    for (const s of segs) {
      if (cursor == null) return undefined;
      cursor = cursor[s];
    }
    return cursor;
  };

  type FieldContext = {
    type?: string;
    label: string;
    description?: string;
    path: string;
    fieldId: string;
    fieldUi: any;
    widget?: string;
    depth: number;
    fieldState: FieldState & { visible?: boolean; enabled?: boolean; readonly?: boolean; transformedValue?: any };
    effectiveReadOnly: boolean;
    fieldValue: any;
  };

  const buildFieldContext = (key: string, def: any, parentPath: string): FieldContext | null => {
    const type = Array.isArray(def.type) ? def.type[0] : def.type;
    const label = def.title || key;
    const description = def.description;
    const path = parentPath ? `${parentPath}.${key}` : key;
    const fieldId = `df-${schemaId}-${path.replace(/\./g, '-')}`;
    const fieldUi = uiSchema?.[path] || uiSchema?.[key];
    const widget = fieldUi?.['ui:widget'];
    const depth = path ? path.split('.').length - 1 : 0;
    const fieldState = fieldStates[path] || { visible: true, enabled: true, readonly: false };
    if (fieldState.visible === false) {
      return null;
    }
    const fieldValue = fieldState.transformedValue !== undefined ? fieldState.transformedValue : getValue(path);
    const effectiveReadOnly = Boolean(readOnly || fieldState.readonly || fieldState.enabled === false);
    return {
      type,
      label,
      description,
      path,
      fieldId,
      fieldUi,
      widget,
      depth,
      fieldState,
      effectiveReadOnly,
      fieldValue,
    };
  };

  const renderPrimitiveControl = ({
    type,
    fieldId,
    fieldValue,
    widget,
    fieldUi,
    effectiveReadOnly,
    path,
  }: {
    type?: string;
    fieldId: string;
    fieldValue: any;
    widget?: string;
    fieldUi: any;
    effectiveReadOnly: boolean;
    path: string;
  }): React.ReactNode => {
    const resolvedType = type || (Array.isArray(fieldUi?.type) ? fieldUi.type[0] : fieldUi?.type) || 'string';

    if (resolvedType === 'string') {
      if (widget === 'textarea') {
        return (
          <textarea
            id={fieldId}
            value={fieldValue ?? ''}
            disabled={effectiveReadOnly}
            onChange={(e) => updateAtPath(path, e.target.value)}
            rows={fieldUi?.rows || 3}
            className="w-full border rounded px-2 py-1 text-sm bg-background"
          />
        );
      }
      return (
        <input
          id={fieldId}
          type="text"
          value={fieldValue ?? ''}
          disabled={effectiveReadOnly}
          onChange={(e) => updateAtPath(path, e.target.value)}
          className="w-full border rounded px-2 py-1 text-sm bg-background"
        />
      );
    }

    if (resolvedType === 'number' || resolvedType === 'integer') {
      return (
        <input
          id={fieldId}
          type="number"
          value={fieldValue ?? ''}
          disabled={effectiveReadOnly}
          onChange={(e) => updateAtPath(path, e.target.value === '' ? undefined : Number(e.target.value))}
          className="w-full border rounded px-2 py-1 text-sm bg-background"
        />
      );
    }

    if (resolvedType === 'boolean') {
      return (
        <input
          id={fieldId}
          type="checkbox"
          checked={!!fieldValue}
          disabled={effectiveReadOnly}
          onChange={(e) => updateAtPath(path, e.target.checked)}
          className="rounded"
        />
      );
    }

    return <span style={{ fontSize: 12, opacity: 0.6 }}>Unsupported type: {String(resolvedType)}</span>;
  };

  const renderField = (key: string, def: any, parentPath: string) => {
    const type = Array.isArray(def.type) ? def.type[0] : def.type;
    const label = def.title || key;
    const description = def.description;
    const path = parentPath ? `${parentPath}.${key}` : key;
    const fieldId = `df-${schemaId}-${path.replace(/\./g,'-')}`;
    const val = getValue(path);
    const fieldUi = uiSchema?.[path] || uiSchema?.[key];
    const widget = fieldUi?.['ui:widget'];
    const depth = path ? path.split('.').length - 1 : 0;
    const accordionIndent = depth * 8; // px
    const isAuto = useAutoLayout;
    
    // Apply rule-based field state
    const fieldState = fieldStates[path] || { visible: true, enabled: true, readonly: false };
    if (!fieldState.visible) {
      return null; // Hide field if rule says so
    }
    const effectiveReadOnly = readOnly || fieldState.readonly || !fieldState.enabled;
    const fieldValue = fieldState.transformedValue !== undefined ? fieldState.transformedValue : val;

    const objectSummary = (definition: any, value: any): string => {
      if (!definition || !definition.properties) return '';
      const keys = Object.keys(definition.properties);
      if (!keys.length) return 'empty';
      const shown = keys.slice(0, 3).join(', ');
      const more = keys.length > 3 ? ` +${keys.length - 3}` : '';
      // Include value hint if available
      let valHint = '';
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const present = Object.keys(value).filter(k => value[k] != null);
        if (present.length) valHint = ` (${present.length} set)`;
      }
      return `${shown}${more}${valHint}`;
    };

    const arraySummary = (value: any[]): string => {
      if (!Array.isArray(value)) return '0 items';
      return `${value.length} item${value.length === 1 ? '' : 's'}`;
    };

    if (type === 'object' && def.properties) {
      let entries = Object.entries(def.properties);
      // Nested ui:order: look up by full path first, then by key
      const nestedUi = uiSchema?.[path] || uiSchema?.[key];
      const nestedOrder = nestedUi?.['ui:order'];
      if (Array.isArray(nestedOrder)) {
        const specified = nestedOrder.filter(k => (def.properties as any)[k] !== undefined);
        const remaining = entries.map(([k]) => k).filter(k => !specified.includes(k));
        const finalOrder = [...specified, ...remaining];
        entries = finalOrder.map(k => [k, (def.properties as any)[k]] as [string, any]);
      }
      if (!isAuto) {
        return (
          <fieldset key={path} style={{ border: '1px solid var(--border,#333)', padding: 8, borderRadius: 4 }}>
            <legend style={{ fontSize: 11, fontWeight: 600 }}>{label}</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {entries.map(([childKey, childDef]) => renderField(childKey, childDef, path))}
            </div>
            {description && <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6 }}>{description}</div>}
          </fieldset>
        );
      }
      // Auto layout accordion style
      const open = openAccordions.has(path) || depth === 0; // root objects open by default
      // Ensure root added to open set for consistent toggle state on first render
      if (depth === 0 && !openAccordions.has(path)) {
        setOpenAccordions(prev => { if (prev.has(path)) return prev; const n = new Set(prev); n.add(path); return n; });
      }
      return (
        <div key={path} style={{ gridColumn: '1 / -1', marginLeft: depth === 0 ? 0 : accordionIndent, border: '1px solid var(--border,#d1d5db)', borderRadius: 6, background: 'var(--card, #fff)' }}>
          <button type="button" onClick={() => toggleAccordion(path)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', width: '100%' }}>
            <span style={{ fontSize: 12, lineHeight: 1 }}>{open ? '▼' : '▶'}</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
            <span style={{ fontSize: 11, opacity: 0.65, marginLeft: 4 }}>{objectSummary(def, val)}</span>
            {description && <span style={{ fontSize: 10, opacity: 0.55, marginLeft: 'auto' }}>{description}</span>}
          </button>
          {open && (
            <div style={{ padding: '8px 10px 10px', display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }}>
              {entries.map(([childKey, childDef]) => renderField(childKey, childDef, path))}
            </div>
          )}
        </div>
      );
    }

    if (type === 'array') {
      const itemsDef = def.items || { type: 'string' };
      const arrVal: any[] = Array.isArray(val) ? val : [];
      const addItem = () => {
        const newItem = itemsDef.type === 'object' ? {} : itemsDef.type === 'array' ? [] : '';
        updateAtPath(path, [...arrVal, newItem]);
      };
      if (!isAuto) {
        return (
          <div key={path} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
              {!readOnly && <button type="button" onClick={addItem} className="text-xs border rounded px-2 py-0.5">Add</button>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {arrVal.map((item, idx) => {
                const itemPath = `${path}.${idx}`;
                const itemType = itemsDef.type;
                let rendered: React.ReactNode;
                if (itemType === 'object' && itemsDef.properties) {
                  rendered = (
                    <div style={{ border: '1px solid #444', padding: 6, borderRadius: 4 }}>
                      {Object.entries(itemsDef.properties).map(([ck, cd]) => renderField(ck, cd, itemPath))}
                    </div>
                  );
                } else if (itemType === 'array') {
                  rendered = <em style={{ fontSize: 11 }}>Nested array not yet supported</em>;
                } else if (itemType === 'boolean') {
                  rendered = <input type="checkbox" checked={!!item} disabled={readOnly} onChange={(e) => {
                    const copy = [...arrVal];
                    copy[idx] = e.target.checked;
                    updateAtPath(path, copy);
                  }} />;
                } else if (itemType === 'number' || itemType === 'integer') {
                  rendered = <input type="number" value={item ?? ''} disabled={readOnly} onChange={(e) => {
                    const copy = [...arrVal];
                    copy[idx] = e.target.value === '' ? undefined : Number(e.target.value);
                    updateAtPath(path, copy);
                  }} className="w-full border rounded px-2 py-1 text-sm bg-background" />;
                } else {
                  rendered = <input type="text" value={item ?? ''} disabled={readOnly} onChange={(e) => {
                    const copy = [...arrVal];
                    copy[idx] = e.target.value;
                    updateAtPath(path, copy);
                  }} className="w-full border rounded px-2 py-1 text-sm bg-background" />;
                }
                return (
                  <div key={itemPath} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {rendered}
                    {!readOnly && <button type="button" onClick={() => removeArrayIndex(path, idx)} className="self-start text-[10px] px-1 py-0.5 border rounded">Remove</button>}
                  </div>
                );
              })}
            </div>
            {description && <div style={{ fontSize: 11, opacity: 0.7 }}>{description}</div>}
          </div>
        );
      }
      // Auto layout: array as accordion
      const open = openAccordions.has(path) || depth === 0;
      if (depth === 0 && !openAccordions.has(path)) {
        setOpenAccordions(prev => { if (prev.has(path)) return prev; const n = new Set(prev); n.add(path); return n; });
      }
      return (
        <div key={path} style={{ gridColumn: '1 / -1', marginLeft: depth === 0 ? 0 : accordionIndent, border: '1px solid var(--border,#d1d5db)', borderRadius: 6, background: 'var(--card,#fff)' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: 8 }}>
            <button type="button" onClick={() => toggleAccordion(path)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12 }}>{open ? '▼' : '▶'}</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: 11, opacity: 0.65 }}>{arraySummary(arrVal)}</span>
            </button>
            {!readOnly && <button type="button" onClick={addItem} className="text-[11px] ml-auto border rounded px-2 py-0.5">Add</button>}
          </div>
          {open && (
            <div style={{ padding: '4px 10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {arrVal.length === 0 && <div style={{ fontSize: 11, opacity: 0.6 }}>No items</div>}
              {arrVal.map((item, idx) => {
                const itemPath = `${path}.${idx}`;
                const itemType = itemsDef.type;
                if (itemType === 'object' && itemsDef.properties) {
                  const itemOpen = openAccordions.has(itemPath);
                  return (
                    <div key={itemPath} style={{ border: '1px solid var(--border,#e2e8f0)', borderRadius: 4, background: 'var(--card,#fff)' }}>
                      <button type="button" onClick={() => toggleAccordion(itemPath)} style={{ all: 'unset', cursor: 'pointer', width: '100%', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12 }}>{itemOpen ? '▼' : '▶'}</span>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>Item #{idx + 1}</span>
                        <span style={{ fontSize: 10, opacity: 0.6 }}>{objectSummary(itemsDef, item)}</span>
                        {!readOnly && <button type="button" onClick={(e) => { e.stopPropagation(); removeArrayIndex(path, idx); }} className="ml-auto text-[10px] border rounded px-1 py-0.5">Remove</button>}
                      </button>
                      {itemOpen && (
                        <div style={{ padding: '6px 8px', display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))' }}>
                          {Object.entries(itemsDef.properties).map(([ck, cd]) => renderField(ck, cd, itemPath))}
                        </div>
                      )}
                    </div>
                  );
                }
                // Primitive item
                return (
                  <div key={itemPath} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {itemType === 'boolean' ? (
                      <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="checkbox" checked={!!item} disabled={readOnly} onChange={(e) => {
                          const copy = [...arrVal];
                          copy[idx] = e.target.checked;
                          updateAtPath(path, copy);
                        }} />
                        <span>Item #{idx + 1}</span>
                      </label>
                    ) : itemType === 'number' || itemType === 'integer' ? (
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>Item #{idx + 1}</label>
                        <input type="number" value={item ?? ''} disabled={readOnly} onChange={(e) => {
                          const copy = [...arrVal];
                          copy[idx] = e.target.value === '' ? undefined : Number(e.target.value);
                          updateAtPath(path, copy);
                        }} className="w-full border rounded px-2 py-1 text-sm bg-background" />
                      </div>
                    ) : (
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>Item #{idx + 1}</label>
                        <input type="text" value={item ?? ''} disabled={readOnly} onChange={(e) => {
                          const copy = [...arrVal];
                          copy[idx] = e.target.value;
                          updateAtPath(path, copy);
                        }} className="w-full border rounded px-2 py-1 text-sm bg-background" />
                      </div>
                    )}
                    {!readOnly && <button type="button" onClick={() => removeArrayIndex(path, idx)} className="self-start text-[10px] px-1 py-0.5 border rounded">Remove</button>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    let input: React.ReactNode;
    if (type === 'string') {
      if (widget === 'textarea') {
        input = (
          <textarea
            id={fieldId}
            value={fieldValue ?? ''}
            disabled={effectiveReadOnly}
            onChange={(e) => updateAtPath(path, e.target.value)}
            rows={fieldUi?.rows || 3}
            className="w-full border rounded px-2 py-1 text-sm bg-background"
          />
        );
      } else {
        input = (
          <input
            id={fieldId}
            type="text"
            value={fieldValue ?? ''}
            disabled={effectiveReadOnly}
            onChange={(e) => updateAtPath(path, e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm bg-background"
          />
        );
      }
    } else if (type === 'number' || type === 'integer') {
      input = (
        <input
          id={fieldId}
          type="number"
          value={fieldValue ?? ''}
          disabled={effectiveReadOnly}
          onChange={(e) => updateAtPath(path, e.target.value === '' ? undefined : Number(e.target.value))}
          className="w-full border rounded px-2 py-1 text-sm bg-background"
        />
      );
    } else if (type === 'boolean') {
      input = (
        <input
          id={fieldId}
          type="checkbox"
          checked={!!fieldValue}
          disabled={effectiveReadOnly}
          onChange={(e) => updateAtPath(path, e.target.checked)}
          className="rounded"
        />
      );
    } else {
      input = <span style={{ fontSize: 12, opacity: 0.6 }}>Unsupported type: {String(type)}</span>;
    }
    const showDescriptionIcon = Boolean(description && useAutoLayout);

    return (
      <div key={path} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label
          htmlFor={fieldId}
          style={{ fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <span>{label}</span>
          {showDescriptionIcon ? (
            <span
              title={description}
              aria-label={`${label} description`}
              style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help', color: 'var(--muted-foreground,#6b7280)' }}
            >
              <Info size={12} strokeWidth={1.75} />
            </span>
          ) : null}
        </label>
        {input}
        {!showDescriptionIcon && description ? (
          <div style={{ fontSize: 11, opacity: 0.7 }}>{description}</div>
        ) : null}
      </div>
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(data);
    if (emitEvent && componentId) {
      emitEvent('onSubmit', {
        timestamp: Date.now(),
        componentId,
        eventType: 'onSubmit',
        data,
      });
    }
  };

  if (layout === 'custom-page') {
    return (
      <div className={className} data-dynamic-form="custom-page">
        <em style={{ fontSize: 12 }}>Custom Page layout not yet implemented. Falling back to auto renderer.</em>
        {/* Falls through to auto layout below (no return) */}
      </div>
    );
  }

  const properties: Record<string, any> = jsonSchema.properties || {};
  let propEntries = Object.entries(properties);
  const order = uiSchema?.['ui:order'];
  if (Array.isArray(order)) {
    const specified = order.filter(k => properties[k] !== undefined);
    const remaining = propEntries.map(([k]) => k).filter(k => !specified.includes(k));
    const finalOrder = [...specified, ...remaining];
    propEntries = finalOrder.map(k => [k, properties[k]] as [string, any]);
  }

  const layoutModeNormalized = layout === 'vertical-table' ? 'vertical-table' : 'auto';
  const useVerticalLayout = layoutModeNormalized === 'vertical-table';
  const useAutoLayout = layoutModeNormalized === 'auto';

  // Responsive grid helper for auto layout: primitive fields share grid, complex spans full width
  const rootAutoLayoutClass = 'grid gap-4';
  const rootAutoLayoutStyle: React.CSSProperties = {
    gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))',
    width: '100%',
  };

  const getOrderedEntries = (definition: any, path: string, key?: string) => {
    if (!definition?.properties) return [] as Array<[string, any]>;
    let entries = Object.entries(definition.properties);
    const nestedUi = uiSchema?.[path] || (key ? uiSchema?.[key] : undefined);
    const nestedOrder = nestedUi?.['ui:order'];
    if (Array.isArray(nestedOrder)) {
      const specified = nestedOrder.filter((k) => (definition.properties as any)[k] !== undefined);
      const remaining = entries.map(([k]) => k).filter((k) => !specified.includes(k));
      const finalOrder = [...specified, ...remaining];
      entries = finalOrder.map((k) => [k, (definition.properties as any)[k]] as [string, any]);
    }
    return entries;
  };

  const VerticalTableSection: React.FC<{
    title: string;
    pairs: Array<{ key: string; name: React.ReactNode; value: React.ReactNode }>;
    actions?: React.ReactNode;
    indentLevel?: number;
    emptyMessage?: string;
  }> = ({ title, pairs, actions, indentLevel = 0, emptyMessage = 'No fields available' }) => {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const [pairsPerRow, setPairsPerRow] = React.useState(3);

    React.useEffect(() => {
      const node = containerRef.current;
      if (!node) return;
      const ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const width = entry.contentRect.width;
        const next = width >= 1300 ? 6 : width >= 700 ? 3 : 1;
        setPairsPerRow((prev) => (prev === next ? prev : next));
      });
      ro.observe(node);
      return () => ro.disconnect();
    }, []);

    const rows = React.useMemo(() => {
      if (pairs.length === 0) return [] as Array<typeof pairs>;
      const chunkSize = Math.max(pairsPerRow, 1);
      const out: Array<typeof pairs> = [];
      for (let i = 0; i < pairs.length; i += chunkSize) {
        out.push(pairs.slice(i, i + chunkSize));
      }
      return out;
    }, [pairs, pairsPerRow]);

    const cellsPerRow = Math.max(pairsPerRow * 2, 2);

    return (
      <div
        ref={containerRef}
        style={{ marginLeft: indentLevel > 0 ? indentLevel * 12 : 0 }}
        className="rounded border border-border bg-card shadow-sm"
      >
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
          {actions}
        </div>
        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={cellsPerRow} className="py-4 text-center text-xs text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, rowIdx) => {
                  const filler = Math.max(cellsPerRow - row.length * 2, 0);
                  return (
                    <TableRow key={rowIdx} className="hover:bg-muted/20">
                      {row.flatMap((pair, pairIdx) => [
                        <TableCell
                          key={`${pair.key}-name-${pairIdx}`}
                          className="align-top text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {pair.name}
                        </TableCell>,
                        <TableCell key={`${pair.key}-value-${pairIdx}`} className="align-top text-xs text-foreground">
                          {pair.value}
                        </TableCell>,
                      ])}
                      {Array.from({ length: filler }).map((_, fillerIdx) => (
                        <TableCell key={`filler-${rowIdx}-${fillerIdx}`} />
                      ))}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  const renderVerticalArray = (label: string, def: any, ctx: FieldContext, depth: number): React.ReactNode => {
    const itemsDef = def.items || { type: 'string' };
    const arrVal: any[] = Array.isArray(ctx.fieldValue) ? ctx.fieldValue : [];
    const itemType = Array.isArray(itemsDef.type) ? itemsDef.type[0] : itemsDef.type;
    const addItem = () => {
      if (ctx.effectiveReadOnly) return;
      let newItem: any = '';
      if (itemType === 'object') newItem = {};
      else if (itemType === 'array') newItem = [];
      else if (itemType === 'number' || itemType === 'integer') newItem = 0;
      else if (itemType === 'boolean') newItem = false;
      updateAtPath(ctx.path, [...arrVal, newItem]);
    };
    const addButton = ctx.effectiveReadOnly ? null : (
      <button
        type="button"
        onClick={addItem}
        className="text-[11px] border border-border rounded px-2 py-0.5 bg-background hover:bg-accent"
      >
        Add
      </button>
    );

    if (itemType === 'object' && itemsDef.properties) {
      return (
        <div key={ctx.path} className="space-y-3">
          <div className="flex items-center justify-between px-1" style={{ marginLeft: depth * 12 }}>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
            {addButton}
          </div>
          {arrVal.length === 0 ? (
            <div
              className="text-[11px] text-muted-foreground border border-dashed border-border/70 rounded px-3 py-4"
              style={{ marginLeft: depth * 12 }}
            >
              No items
            </div>
          ) : (
            arrVal.map((_, idx) => {
              const itemPath = `${ctx.path}.${idx}`;
              const itemEntries = getOrderedEntries(itemsDef, itemPath, String(idx));
              const removeButton = ctx.effectiveReadOnly
                ? null
                : (
                    <button
                      type="button"
                      onClick={() => removeArrayIndex(ctx.path, idx)}
                      className="text-[10px] border border-border rounded px-2 py-0.5 text-red-500 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  );
              return (
                <div key={itemPath} style={{ marginLeft: depth * 12 }} className="space-y-2">
                  {renderVerticalSection(`${label} #${idx + 1}`, itemEntries, itemPath, depth + 1, removeButton)}
                </div>
              );
            })
          )}
        </div>
      );
    }

    const primitivePairs = arrVal.map((item, idx) => {
      const itemPath = `${ctx.path}.${idx}`;
      const itemId = `df-${schemaId}-${itemPath.replace(/\./g, '-')}`;
      return {
        key: itemPath,
        name: <span className="text-xs font-semibold text-muted-foreground">Item #{idx + 1}</span>,
        value: (
          <div className="flex items-center gap-2">
            {renderPrimitiveControl({
              type: itemType,
              fieldId: itemId,
              fieldValue: item,
              widget: undefined,
              fieldUi: {},
              effectiveReadOnly: ctx.effectiveReadOnly,
              path: itemPath,
            })}
            {!ctx.effectiveReadOnly && (
              <button
                type="button"
                onClick={() => removeArrayIndex(ctx.path, idx)}
                className="text-[10px] border border-border rounded px-2 py-0.5"
              >
                Remove
              </button>
            )}
          </div>
        ),
      };
    });

    return (
      <VerticalTableSection
        key={ctx.path}
        title={label}
        pairs={primitivePairs}
        actions={addButton}
        indentLevel={depth}
        emptyMessage="No items"
      />
    );
  };

  const renderVerticalSection = (
    title: string,
    entries: Array<[string, any]>,
    parentPath: string,
    depth: number,
    headerActions?: React.ReactNode,
  ): React.ReactNode => {
    const primitivePairs: Array<{ key: string; name: React.ReactNode; value: React.ReactNode }> = [];
    const nestedNodes: React.ReactNode[] = [];

    entries.forEach(([childKey, childDef]) => {
      const ctx = buildFieldContext(childKey, childDef, parentPath);
      if (!ctx) return;

      if (ctx.type === 'object' && childDef.properties) {
        const nestedEntries = getOrderedEntries(childDef, ctx.path, childKey);
        nestedNodes.push(renderVerticalSection(ctx.label, nestedEntries, ctx.path, depth + 1));
        return;
      }

      if (ctx.type === 'array') {
        nestedNodes.push(renderVerticalArray(ctx.label, childDef, ctx, depth + 1));
        return;
      }

      const control = renderPrimitiveControl({
        type: ctx.type,
        fieldId: ctx.fieldId,
        fieldValue: ctx.fieldValue,
        widget: ctx.widget,
        fieldUi: ctx.fieldUi,
        effectiveReadOnly: ctx.effectiveReadOnly,
        path: ctx.path,
      });

      const nameNode = (
        <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
          <span>{ctx.label}</span>
          {ctx.description ? (
            <span
              title={ctx.description}
              className="flex h-4 w-4 items-center justify-center rounded-full border border-border/60 text-muted-foreground"
            >
              <Info size={12} strokeWidth={1.75} />
            </span>
          ) : null}
        </div>
      );

      const valueNode = (
        <div className="flex flex-col gap-2">
          {control}
        </div>
      );

      primitivePairs.push({ key: ctx.path, name: nameNode, value: valueNode });
    });

    return (
      <div key={parentPath || title} className="space-y-3">
        <VerticalTableSection
          title={title}
          pairs={primitivePairs}
          actions={headerActions}
          indentLevel={depth}
        />
        {nestedNodes}
      </div>
    );
  };

  const renderFieldWithAutoLayout = (key: string, def: any, parentPath: string) => {
    const node = renderField(key, def, parentPath);
    const type = Array.isArray(def.type) ? def.type[0] : def.type;
    if (type === 'object' || type === 'array') {
      return (
        <div key={(parentPath ? `${parentPath}.` : '') + key} style={{ gridColumn: '1 / -1' }}>
          {node}
        </div>
      );
    }
    return node;
  };

  if (schemaMissing) {
    return (
      <div className={className} data-dynamic-form="missing">
        <div style={{ fontSize: 12, opacity: 0.75 }}>Schema not found for id: <code>{schemaId}</code></div>
        <div style={{ marginTop: 6 }}>
          <pre style={{ fontSize: 10, background: 'var(--muted,#111)', padding: 8, borderRadius: 4, overflowX: 'auto' }}>{`// Example dev registration \nschemaRegistry.register('${schemaId}', undefined, {\n  type: 'object',\n  properties: {\n    example: { type: 'string', title: 'Example Field' }\n  }\n});`}</pre>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className} data-dynamic-form={layoutModeNormalized}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {propEntries.length === 0 && (
          <div style={{ fontSize: 12, opacity: 0.7 }}>Schema has no object properties to render.</div>
        )}
        {useAutoLayout && (
          <div className={rootAutoLayoutClass} style={rootAutoLayoutStyle}>
            {propEntries.map(([key, def]) => renderFieldWithAutoLayout(key, def, ''))}
          </div>
        )}
        {useVerticalLayout && propEntries.length > 0 && (
          <div className="flex flex-col gap-4">
            {renderVerticalSection(jsonSchema.title || schemaId || 'Details', propEntries, '', 0)}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button type="submit" disabled={readOnly} className="px-3 py-1 text-xs border rounded bg-accent">Submit</button>
          <button type="button" disabled={!isDirty} onClick={() => { setData(value ?? {}); setDirty(false); }} className="px-3 py-1 text-xs border rounded">Reset</button>
        </div>
        {errors && errors.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <strong style={{ fontSize: 12 }}>Validation Errors</strong>
            <ul style={{ fontSize: 11, marginTop: 4, paddingLeft: 18 }}>
              {errors.map((e, i) => <li key={i}>{e.instancePath || '(root)'}: {e.message}</li>)}
            </ul>
          </div>
        )}
      </div>
    </form>
  );
};

export default DynamicForm;