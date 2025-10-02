"use client";
import React, { useEffect, useRef } from 'react';
import { DynamicForm } from '@/components/dynamic-form/DynamicForm';
import type { DynamicFormProps } from '@/components/dynamic-form/DynamicForm';
import { globalSandbox } from '@/lib/script-sandbox';

export interface PageBuilderDynamicFormProps extends Omit<DynamicFormProps, 'schemaId' | 'layout' | 'readOnly' | 'value'> {
  'data-schema-id'?: string;
  'data-form-layout'?: string;
  'data-readonly'?: string;
  'data-initial-value'?: string;
  'data-bindings'?: string;
  'data-ui-schema'?: string;
  'data-rules'?: string; // JSON string of FieldRule[]
  // Event scripts
  'data-onChange-script'?: string;
  'data-onSubmit-script'?: string;
  'data-onValidate-script'?: string;
  'data-component-type'?: string;
  // Editor helpers
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

/**
 * PageBuilder wrapper for DynamicForm
 */
export const PageBuilderDynamicForm: React.FC<PageBuilderDynamicFormProps> = ({
  'data-schema-id': schemaId,
  'data-form-layout': layoutMode,
  'data-readonly': readOnlyFlag,
  'data-initial-value': initialValueJSON,
  'data-bindings': bindingsJSON,
  'data-ui-schema': uiSchemaJSON,
  'data-rules': rulesJSON,
  'data-onChange-script': onChangeScript,
  'data-onSubmit-script': onSubmitScript,
  'data-onValidate-script': onValidateScript,
  'data-component-type': componentType,
  style,
  onClick,
  ...rest
}) => {
  const initial = useRef<any>(undefined);
  const parsedInitial = React.useMemo(() => {
    if (!initialValueJSON) return undefined;
    try { return JSON.parse(initialValueJSON); } catch { return undefined; }
  }, [initialValueJSON]);

  const parsedBindings = React.useMemo(() => {
    if (!bindingsJSON) return undefined;
    try { return JSON.parse(bindingsJSON); } catch { return undefined; }
  }, [bindingsJSON]);

  const parsedUiSchema = React.useMemo(() => {
    if (!uiSchemaJSON) return undefined;
    try { return JSON.parse(uiSchemaJSON); } catch { return undefined; }
  }, [uiSchemaJSON]);

  const parsedRules = React.useMemo(() => {
    if (!rulesJSON) return undefined;
    try { return JSON.parse(rulesJSON); } catch { return undefined; }
  }, [rulesJSON]);

  useEffect(() => {
    if (parsedInitial && initial.current === undefined) {
      initial.current = parsedInitial;
    }
  }, [parsedInitial]);

  // context builder for scripts
  const buildContext = React.useCallback(() => ({
    component: {
      id: schemaId || 'dynamic-form',
      type: 'DynamicForm',
      getProps: () => ({ schemaId, layout: layoutMode, readOnly: readOnlyFlag }),
      setProps: (_: any) => { /* no-op for now */ },
      emit: (evt: string, payload: any) => { console.log('[DynamicForm emit]', evt, payload); },
      callAction: async (_actionName: string, _params: any) => ({ success: true })
    },
    form: {
      getData: () => currentDataRef.current,
    },
    data: {
      query: async (_: string) => ({}),
      mutate: async (_: any) => ({}),
      subscribe: (_cb: (d: any) => void) => () => {}
    },
    page: {
      navigate: (_: string) => {},
      getState: () => ({}),
      setState: (_: any) => {},
      dispatch: (_: any) => {}
    },
    app: {
      getGlobalState: () => ({}),
      setGlobalState: (_: any) => {},
      showNotification: (m: string) => console.log('[Notify]', m),
      callWorkflow: async (_: string, __: any) => ({ success: true })
    },
    utils: {
      log: (msg: string, level: string = 'info') => console[level === 'error' ? 'error' : 'log']('[DynamicFormScript]', msg),
      formatDate: (date: Date | string) => {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toISOString();
      },
      validateSchema: (data: any, _schema: any) => ({ valid: true, errors: [] as string[] }),
      debounce: <T extends (...args: any[]) => void>(fn: T, _delay: number) => fn,
      throttle: <T extends (...args: any[]) => void>(fn: T, _delay: number) => fn
    }
  }), [schemaId, layoutMode, readOnlyFlag]);

  const currentDataRef = useRef<any>(parsedInitial || {});

  const handleChange = React.useCallback((data: any) => {
    currentDataRef.current = data;
    if (onChangeScript) {
      globalSandbox.executeScript('dynamic-form-onChange', onChangeScript, buildContext(), { data });
    }
  }, [onChangeScript, buildContext]);

  const handleSubmit = React.useCallback((data: any) => {
    if (onSubmitScript) {
      globalSandbox.executeScript('dynamic-form-onSubmit', onSubmitScript, buildContext(), { data });
    }
  }, [onSubmitScript, buildContext]);

  const handleValidate = React.useCallback((valid: boolean, errors?: any) => {
    if (onValidateScript) {
      globalSandbox.executeScript('dynamic-form-onValidate', onValidateScript, buildContext(), { valid, errors });
    }
  }, [onValidateScript, buildContext]);

  if (!schemaId) {
    return <div className="text-xs text-muted-foreground border border-dashed p-2 rounded" style={style} onClick={onClick}>DynamicForm: set data-schema-id</div>;
  }

  return (
    <div style={style} onClick={onClick} data-component-type={componentType}>
      <DynamicForm
        schemaId={schemaId}
        layout={(layoutMode as any) || 'auto'}
        readOnly={readOnlyFlag === 'true'}
        value={parsedInitial}
        bindings={parsedBindings}
        uiSchema={parsedUiSchema}
        rules={parsedRules}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onValidate={handleValidate}
        {...rest as any}
      />
    </div>
  );
};
