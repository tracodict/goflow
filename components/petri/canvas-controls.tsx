"use client"
import { Controls, ControlButton } from '@xyflow/react'
import { Save, Lock, LockOpen, Eye, Folder, ZoomIn, ZoomOut, Maximize2, SlidersHorizontal, CirclePlus, SquarePlus, WandSparkles, UserRoundCheck, MonitorPlay } from 'lucide-react'

interface CanvasControlsProps {
  onSave: () => void | Promise<void>
  edited: boolean
  interactive: boolean
  setInteractive: React.Dispatch<React.SetStateAction<boolean>>
  showSystem: boolean
  toggleSystem: () => void
  openExplorer: () => void | Promise<void>
  panelMode: 'mini' | 'normal' | 'full'
  openProperties: () => void
  addPlace: () => void
  addTransition: () => void
  onAutoLayout: () => void | Promise<void>
  onValidate?: () => void | Promise<void>
  zoomIn?: (opts?: any) => void
  zoomOut?: (opts?: any) => void
  fitView?: (opts?: any) => void
  controlsRight: number
  onOpenRun?: () => void | Promise<void>
}

export function CanvasControls({ onSave, edited, interactive, setInteractive, showSystem, toggleSystem, openExplorer, panelMode, openProperties, addPlace, addTransition, zoomIn, zoomOut, fitView, controlsRight, onAutoLayout, onValidate, onOpenRun }: CanvasControlsProps) {
  return (
    <div
      style={{ position: 'absolute', right: controlsRight, bottom: 12, zIndex: 10, pointerEvents: 'auto' }}
      aria-label="Canvas toolbar"
    >
      <Controls position="bottom-right" showZoom={false} showFitView={false} showInteractive={false}>
        <ControlButton
          onClick={onSave}
          title={edited ? 'Save workflow' : 'No changes'}
          disabled={!edited}
          style={{ opacity: edited ? 1 : 0.5 }}
        >
          <Save className="h-4 w-4" />
        </ControlButton>
        <ControlButton
          onClick={() => setInteractive(v => !v)}
          title={interactive ? 'Disable interactivity' : 'Enable interactivity'}
        >
          {interactive ? <LockOpen className="h-4 w-4" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
        </ControlButton>
        <ControlButton
          onClick={toggleSystem}
          title={showSystem ? 'Hide System panel' : 'Show System panel'}
        >
          <Eye className="h-4 w-4" aria-hidden />
        </ControlButton>
        <ControlButton
          onClick={openExplorer}
          title="Open Explorer"
        >
          <Folder className="h-4 w-4" aria-hidden />
        </ControlButton>
        <ControlButton onClick={() => zoomIn?.({ duration: 200 })} title="Zoom in" aria-label="Zoom in">
          <ZoomIn className="h-5 w-5" aria-hidden />
        </ControlButton>
        <ControlButton onClick={() => zoomOut?.({ duration: 200 })} title="Zoom out" aria-label="Zoom out">
          <ZoomOut className="h-5 w-5" aria-hidden />
        </ControlButton>
        <ControlButton onClick={() => fitView?.({ padding: 0.2, duration: 300 })} title="Fit view">
          <Maximize2 className="h-4 w-4" aria-hidden />
        </ControlButton>
        {panelMode === 'mini' && (
          <ControlButton onClick={openProperties} title="Open Properties">
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
          </ControlButton>
        )}
        <ControlButton onClick={addPlace} title="Add Place">
          <CirclePlus className="h-4 w-4" aria-hidden />
        </ControlButton>
        <ControlButton onClick={addTransition} title="Add Transition">
          <SquarePlus className="h-4 w-4" aria-hidden />
        </ControlButton>
        <ControlButton onClick={onAutoLayout} title="Auto layout">
          <WandSparkles className="h-4 w-4" aria-hidden />
        </ControlButton>
        {onOpenRun && (
          <ControlButton onClick={onOpenRun} title="Open Run Mode">
            <MonitorPlay className="h-4 w-4" aria-hidden />
          </ControlButton>
        )}
        {onValidate && (
          <ControlButton onClick={onValidate} title="Validate workflow">
            <UserRoundCheck className="h-4 w-4" aria-hidden />
          </ControlButton>
        )}
      </Controls>
    </div>
  )
}
