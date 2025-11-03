"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Play, RefreshCw, Save, FileCode } from "lucide-react"
import {
  generateGoScript,
  getGoScript,
  updateGoScript,
  syncGoScript,
  getCpn,
} from "./petri-client";
import { useFlowServiceUrl } from '@/hooks/use-flow-service-url'
import { toast } from '@/hooks/use-toast'
import { EditorView, basicSetup } from "codemirror"
import { EditorState, type Extension } from "@codemirror/state"
import { StreamLanguage } from "@codemirror/language"
import { go } from "@codemirror/legacy-modes/mode/go"
import { useWorkspace } from "@/stores/workspace-store";

interface GoScriptEditorProps {
  workflowId: string
  onClose?: () => void
}

export function GoScriptEditor({ workflowId, onClose }: GoScriptEditorProps) {
  const flowServiceUrl = useFlowServiceUrl({ includeDefault: false })
  const { saveFile } = useWorkspace();
  const [script, setScript] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [editorView, setEditorView] = useState<EditorView | null>(null)
  const editorContainerRef = React.useRef<HTMLDivElement>(null)

  // Load existing script on mount
  useEffect(() => {
    if (!flowServiceUrl || !workflowId) return
    
    const loadScript = async () => {
      setLoading(true)
      try {
        const response = await getGoScript(flowServiceUrl, workflowId)
        const scriptContent = response?.data?.script || response?.script || ""
        setScript(scriptContent)
      } catch (error: any) {
        // If script doesn't exist yet, that's okay - we'll generate it
        if (error?.message?.includes("404") || error?.message?.includes("not found")) {
          setScript("// No Go script generated yet. Click 'Generate' to create one.")
        } else {
          toast({
            title: "Error loading script",
            description: error?.message || "Failed to load Go script",
            variant: "destructive",
          })
        }
      } finally {
        setLoading(false)
      }
    }

    loadScript()
  }, [flowServiceUrl, workflowId])

  // Initialize CodeMirror editor
  useEffect(() => {
    if (!editorContainerRef.current || editorView) return

    const extensions: Extension[] = [
      basicSetup,
      StreamLanguage.define(go),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const newContent = update.state.doc.toString()
          setScript(newContent)
          setHasChanges(true)
        }
      }),
    ]

    const startState = EditorState.create({
      doc: script,
      extensions,
    })

    const view = new EditorView({
      state: startState,
      parent: editorContainerRef.current,
    })

    setEditorView(view)

    return () => {
      view.destroy()
      setEditorView(null)
    }
  }, []) // Only run once on mount

  // Update editor content when script changes externally
  useEffect(() => {
    if (!editorView) return
    const currentContent = editorView.state.doc.toString()
    if (currentContent !== script) {
      editorView.dispatch({
        changes: { from: 0, to: currentContent.length, insert: script }
      })
    }
  }, [script, editorView])

  const handleGenerate = useCallback(async () => {
    if (!flowServiceUrl || !workflowId) return
    
    setGenerating(true)
    try {
      const response = await generateGoScript(flowServiceUrl, workflowId)
      const generatedScript = response?.data?.script || response?.script || ""
      setScript(generatedScript)
      setHasChanges(false)
      toast({
        title: "Script generated",
        description: "Go script has been generated from the workflow definition",
      })
    } catch (error: any) {
      toast({
        title: "Generation failed",
        description: error?.message || "Failed to generate Go script",
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }, [flowServiceUrl, workflowId])

  const handleSave = useCallback(async () => {
    if (!flowServiceUrl || !workflowId) return;

    setSaving(true);
    try {
      // 1. Update script
      await updateGoScript(flowServiceUrl, workflowId, script);
      toast({
        title: "Script saved",
        description: "Go script has been updated successfully.",
      });

      // 2. Sync script to CPN
      await syncGoScript(flowServiceUrl, workflowId);
      toast({
        title: "Script synced",
        description: "Changes have been synced to the CPN model.",
      });

      // 3. Get updated CPN and sync to store
      const updatedCpn = await getCpn(flowServiceUrl, workflowId);
      if (updatedCpn.data) {
        const filePath = `Workflows/${workflowId}.cpn`;
        await saveFile(filePath, JSON.stringify(updatedCpn.data, null, 2));
        toast({
          title: "Workflow updated",
          description: `Saved updated CPN model to ${filePath}.`,
        });
      }

      setHasChanges(false);
    } catch (error: any) {
      toast({
        title: "An error occurred",
        description: error?.message || "One or more steps failed.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [flowServiceUrl, workflowId, script, saveFile]);

  const handleRefresh = useCallback(async () => {
    if (!flowServiceUrl || !workflowId) return
    
    if (hasChanges) {
      const confirmed = window.confirm("You have unsaved changes. Refreshing will discard them. Continue?")
      if (!confirmed) return
    }

    setLoading(true)
    try {
      const response = await getGoScript(flowServiceUrl, workflowId)
      const scriptContent = response?.data?.script || response?.script || ""
      setScript(scriptContent)
      setHasChanges(false)
      toast({
        title: "Script refreshed",
        description: "Loaded latest version from server",
      })
    } catch (error: any) {
      toast({
        title: "Refresh failed",
        description: error?.message || "Failed to refresh Go script",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [flowServiceUrl, workflowId, hasChanges])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <FileCode className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Go Script</span>
          {hasChanges && <span className="text-xs text-orange-600">• Modified</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGenerate}
            disabled={generating || loading}
          >
            <Play className="h-3.5 w-3.5 mr-1" />
            {generating ? "Generating..." : "Generate"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={loading || generating}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving || loading}
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden p-2">
        {loading && !editorView ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Loading script...
          </div>
        ) : (
          <div
            ref={editorContainerRef}
            className="h-full border rounded-md overflow-auto"
            style={{ fontSize: '13px' }}
          />
        )}
      </div>
    </div>
  )
}
