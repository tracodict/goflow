"use client"
import React from 'react'
import { WorkflowTokens } from './WorkflowTokens'
import { globalSandbox } from '@/lib/script-sandbox'
import type { BaseEventPayload, EventHandlerContext } from '@/lib/component-interface'

export interface PageBuilderWorkflowTokensProps {
  "data-element-id"?: string
  "data-workflow-color"?: string
  "data-workflow-base-url"?: string
  "data-workflow-dictionary-url"?: string
  // future script events
  "data-script-mount"?: string
  "data-script-unmount"?: string
}

export const PageBuilderWorkflowTokens: React.FC<PageBuilderWorkflowTokensProps> = ({
  "data-element-id": elementId,
  "data-workflow-color": color,
  "data-workflow-base-url": baseUrl,
  "data-workflow-dictionary-url": dictionaryUrl,
  "data-script-mount": scriptMount,
  "data-script-unmount": scriptUnmount,
  ...rest
}) => {
  const finalColor = color || 'INT'
  const finalBaseUrl = baseUrl || '/api'
  const finalDictionaryUrl = dictionaryUrl || '/api/dictionary'
  const reactId = React.useId()
  const finalElementId = elementId || `workflow-tokens-${reactId.replace(/[:]/g,'')}`

  // construct basic context similar to DataGrid wrapper for scripting
  const createContext = React.useCallback((): EventHandlerContext => ({
    component: {
      id: finalElementId,
      type: 'workflow-tokens',
      getProps: () => ({ color: finalColor, baseUrl: finalBaseUrl, dictionaryUrl: finalDictionaryUrl }),
      setProps: () => {},
      emit: () => {},
      callAction: async () => ({})
    },
    data: {
      query: async () => ({}),
      mutate: async () => ({}),
      subscribe: () => () => {}
    },
    page: {
      navigate: () => {},
      getState: () => ({}),
      setState: () => {},
      dispatch: () => {}
    },
    app: {
      getGlobalState: () => ({}),
      setGlobalState: () => {},
      showNotification: () => {},
      callWorkflow: async () => ({ success: true })
    },
    utils: {
      formatDate: (d: Date | string) => (typeof d === 'string' ? new Date(d) : d).toISOString(),
      validateSchema: () => ({ valid: true }),
      debounce: <T extends (...args: any[]) => void>(fn: T) => fn,
      throttle: <T extends (...args: any[]) => void>(fn: T) => fn,
      log: () => {}
    }
  }), [finalElementId, finalColor, finalBaseUrl, finalDictionaryUrl])

  // lifecycle script execution
  React.useEffect(() => {
    if (scriptMount) {
      const payload: BaseEventPayload = { timestamp: Date.now(), componentId: finalElementId, eventType: 'mount' }
      globalSandbox.executeScript('workflow-tokens-mount', scriptMount, createContext(), payload)
    }
    return () => {
      if (scriptUnmount) {
        const payload: BaseEventPayload = { timestamp: Date.now(), componentId: finalElementId, eventType: 'unmount' }
        globalSandbox.executeScript('workflow-tokens-unmount', scriptUnmount, createContext(), payload)
      }
    }
  }, [scriptMount, scriptUnmount, finalElementId, createContext])

  return (
    <WorkflowTokens
      elementId={finalElementId}
      color={finalColor}
      baseUrl={finalBaseUrl}
      dictionaryUrl={finalDictionaryUrl}
      isPreview
      {...rest as any}
    />
  )
}
