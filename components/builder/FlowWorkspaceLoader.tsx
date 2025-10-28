"use client"

import React, { useEffect, useRef, useState } from "react"
import { FlowWorkspace } from "../petri/flow-workspace"
import { useWorkspace } from "@/stores/workspace-store"
import { getTabState, setTabState } from "@/stores/pagebuilder/tab-state-cache"
import { FlowWorkspaceStoreProvider, clearFlowWorkspaceStore } from "@/stores/petri/flow-editor-context"

interface FlowWorkspaceLoaderProps {
  tabId: string
  filePath?: string
  isFocused: boolean
}

/**
 * FlowWorkspace expects workflow data to arrive via the global
 * `goflow-open-workflow` event. This loader bridges the workspace
 * file cache and the canvas by dispatching the event whenever the
 * backing file becomes available or changes on disk.
 */
export const FlowWorkspaceLoader: React.FC<FlowWorkspaceLoaderProps> = ({ tabId, filePath }) => {
  const { files, openFile } = useWorkspace()
  const [loading, setLoading] = useState<boolean>(!!filePath)
  const [error, setError] = useState<string | null>(null)
  const requestedRef = useRef<Set<string>>(new Set())
  const lastSignatureRef = useRef<string | null>(null)
  const prevPathRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (prevPathRef.current !== filePath) {
      prevPathRef.current = filePath
      lastSignatureRef.current = null
      setError(null)
      setLoading(!!filePath)
    }
  }, [filePath])

  useEffect(() => {
    if (!filePath) {
      setLoading(false)
      setError("No workflow selected")
      return
    }

    if (!lastSignatureRef.current) {
      const cached = getTabState(filePath)?.workflow
      if (cached) {
        window.dispatchEvent(
          new CustomEvent("goflow-open-workflow", { detail: { path: filePath, data: cached } })
        )
        lastSignatureRef.current = `cache:${filePath}`
      }
    }

    const file = files.get(filePath)
    if (!file) {
      if (!requestedRef.current.has(filePath)) {
        requestedRef.current.add(filePath)
        setLoading(true)
        openFile(filePath).catch((err: any) => {
          console.error("Failed to open workflow file", err)
          setError("Unable to load workflow file")
          setLoading(false)
        })
      }
      return
    }

    requestedRef.current.delete(filePath)
    setLoading(false)
    setError(null)

    const signature = `${filePath}:${file.sha ?? file.content.length}`
    if (signature === lastSignatureRef.current) {
      return
    }

    let parsed: any
    if (file.data && typeof file.data === "object") {
      parsed = file.data
    } else {
      try {
        parsed = JSON.parse(file.content)
      } catch (err) {
        console.error("Workflow file parse error", err)
        setError("Workflow file contains invalid JSON")
        return
      }
    }

    setTabState(filePath, { workflow: parsed })
    lastSignatureRef.current = signature
    window.dispatchEvent(
      new CustomEvent("goflow-open-workflow", { detail: { path: filePath, data: parsed } })
    )
  }, [filePath, files, openFile])

  useEffect(() => {
    return () => {
      clearFlowWorkspaceStore(tabId)
    }
  }, [tabId])

  return (
    <FlowWorkspaceStoreProvider tabId={tabId}>
      <div className="relative h-full">
        <FlowWorkspace />
        {loading ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/80 text-sm text-muted-foreground">
            Loading workflow…
          </div>
        ) : null}
        {error ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-destructive/10 text-sm text-destructive">
            {error}
          </div>
        ) : null}
      </div>
    </FlowWorkspaceStoreProvider>
  )
}
