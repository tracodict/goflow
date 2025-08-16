import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FolderPlus, CirclePlus, SquarePlus, Square, Link2, Boxes, ArrowLeftRight, Circle, ArrowRight, Trash2, Folder } from 'lucide-react';
import { workflows, getWorkflow, addWorkflow, addPlace, addTransition, addArc, deleteWorkflow, deletePlace, deleteTransition, deleteArc, renameWorkflow, renamePlace, renameTransition } from './mock-workflow-store';

function RenameableText({ label, onRename, className, inputStyle, onAfterRename }: {
  label: string;
  onRename: (next: string) => void;
  className?: string;
  inputStyle?: React.CSSProperties;
  onAfterRename?: () => void;
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(label)
  useEffect(() => {
    if (!editing) setValue(label)
  }, [label, editing])

  const commit = () => {
    const next = value.trim()
    if (next && next !== label) onRename(next)
    setEditing(false)
    onAfterRename?.()
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setValue(label) } }}
        style={{ fontSize: 12, border: '1px solid #ddd', borderRadius: 4, padding: '2px 4px', ...inputStyle }}
        onClick={(e) => e.stopPropagation()}
      />
    )
  }
  return (
    <span className={className} onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}>{label}</span>
  )
}

type ExplorerSelection = { kind: 'workflow'; workflowId: string } | { kind: 'place'|'transition'|'arc'; workflowId: string; id: string } | null

function ExplorerNode({ workflowId, selectedId, onSelect, onEntitySelect, persistKey }:{ workflowId: string; selectedId: string|null; onSelect:(id:string|null)=>void; onEntitySelect:(sel:ExplorerSelection)=>void; persistKey: string }) {
  const [expanded, setExpanded] = useState<{[k:string]:boolean}>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const raw = window.localStorage.getItem(persistKey + ':' + workflowId)
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  });
  const workflow = getWorkflow(workflowId);
  if (!workflow) return null;

  const toggle = (key: string) => setExpanded(e => {
    const next = { ...e, [key]: !e[key] }
    try { if (typeof window !== 'undefined') window.localStorage.setItem(persistKey + ':' + workflowId, JSON.stringify(next)) } catch {}
    return next
  });
  const loadThisWorkflow = () => {
    const evt = new CustomEvent('loadWorkflow', { detail: { workflowId } });
    window.dispatchEvent(evt);
    onSelect(workflowId)
  };

  const isSelected = selectedId === workflowId
  const isOpen = !!expanded['__wf']

  return (
    <div style={{ marginLeft: 8 }}>
      <div
        className="group"
        style={{ fontWeight: isSelected ? 'bold' as const : 'normal', cursor: 'pointer', display:'flex', alignItems:'center', gap:6 }}
        title="Load workflow / Expand"
        onClick={(e) => { e.stopPropagation(); setExpanded(ex => ({ ...ex, ['__wf']: !ex['__wf'] })); loadThisWorkflow(); }}
      >
        <Folder className="h-4 w-4" style={{ opacity: isOpen ? 0.5 : 1 }} />
        <RenameableText
          label={workflow.name}
          onRename={(next) => renameWorkflow(workflowId, next)}
          onAfterRename={() => setExpanded(ex => ({ ...ex }))}
        />
        {/* delete workflow */}
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ marginLeft: 'auto', fontSize: 12, display:'flex', alignItems:'center' }}
          title="Delete workflow"
          onClick={(e)=>{ e.stopPropagation(); deleteWorkflow(workflowId); onSelect(null); }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {isOpen && (
      <div>
        <div style={{ marginLeft: 12 }}>
          <div onClick={(e) => { e.stopPropagation(); toggle('places') }} style={{ cursor: 'pointer', display:'flex', alignItems:'center', gap:6 }}>
            <Boxes className="h-4 w-4" style={{ opacity: expanded['places'] ? 0.5 : 1 }} />
            <span>places</span>
          </div>
          {expanded['places'] && (
            <ul style={{ marginLeft: 12 }}>
              {workflow.places.map(p => {
                const active = selectedId === p.id
                return (
                  <li key={p.id} className="group" style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', background: active? '#f0f0f0':'transparent', borderRadius:4, padding:'2px 4px' }}
                    onClick={(e) => { e.stopPropagation(); onEntitySelect({ kind:'place', workflowId, id:p.id }); }}
                  >
                    <Circle className="h-3.5 w-3.5" />
                    <RenameableText
                      label={p.name}
                      onRename={(next) => renamePlace(workflowId, p.id, next)}
                      onAfterRename={() => setExpanded(ex => ({ ...ex }))}
                    />
                    <button title="Delete place" className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ marginLeft:'auto', fontSize: 12, display:'flex', alignItems:'center' }} onClick={(e)=>{ e.stopPropagation(); deletePlace(workflowId, p.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <div onClick={(e) => { e.stopPropagation(); toggle('transitions') }} style={{ cursor: 'pointer', display:'flex', alignItems:'center', gap:6 }}>
            <ArrowLeftRight className="h-4 w-4" style={{ opacity: expanded['transitions'] ? 0.5 : 1 }} />
            <span>transitions</span>
          </div>
          {expanded['transitions'] && (
            <ul style={{ marginLeft: 12 }}>
              {workflow.transitions.map(t => {
                const active = selectedId === t.id
                return (
                  <li key={t.id} className="group" style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', background: active? '#f0f0f0':'transparent', borderRadius:4, padding:'2px 4px' }}
                    onClick={(e) => { e.stopPropagation(); onEntitySelect({ kind:'transition', workflowId, id:t.id }); }}
                  >
                    <Square className="h-3.5 w-3.5" />
                    <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <RenameableText
                        label={t.name}
                        onRename={(next) => renameTransition(workflowId, t.id, next)}
                        onAfterRename={() => setExpanded(ex => ({ ...ex }))}
                      />
                      {t.type === 'workflow' && t.workflowRef ? <span style={{color:'#888'}}> (workflow: {getWorkflow(t.workflowRef)?.name || t.workflowRef})</span> : null}
                    </span>
                    <button title="Delete transition" className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ marginLeft:'auto', fontSize: 12, display:'flex', alignItems:'center' }} onClick={(e)=>{ e.stopPropagation(); deleteTransition(workflowId, t.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <div onClick={(e) => { e.stopPropagation(); toggle('arcs') }} style={{ cursor: 'pointer', display:'flex', alignItems:'center', gap:6 }}>
            <Link2 className="h-4 w-4" style={{ opacity: expanded['arcs'] ? 0.5 : 1 }} />
            <span>arcs</span>
          </div>
          {expanded['arcs'] && (
            <ul style={{ marginLeft: 12 }}>
              {workflow.arcs.map(a => {
                const active = selectedId === a.id
                return (
                  <li key={a.id} className="group" style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', background: active? '#f0f0f0':'transparent', borderRadius:4, padding:'2px 4px' }}
                    onClick={(e) => { e.stopPropagation(); onEntitySelect({ kind:'arc', workflowId, id:a.id }); }}
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span>{a.sourceId} → {a.targetId}</span>
                    <button title="Delete arc" className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ marginLeft:'auto', fontSize: 12, display:'flex', alignItems:'center' }} onClick={(e)=>{ e.stopPropagation(); deleteArc(workflowId, a.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        {workflow.subWorkflows.length > 0 && (
          <div>
            <div>Sub Workflows:</div>
            <ul>
              {workflow.subWorkflows.map(subId => (
                <li key={subId}>
                  <ExplorerNode workflowId={subId} selectedId={selectedId} onSelect={onSelect} onEntitySelect={onEntitySelect} persistKey={persistKey} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

export default function ExplorerPanel({
  workflows: propWorkflows,
  onWorkflowSelect,
  onEntitySelect,
  persistKey = 'goflow.explorer.expanded',
}: {
  workflows?: any[];
  onWorkflowSelect?: (workflowId: string) => void;
  onEntitySelect?: (sel: ExplorerSelection) => void;
  persistKey?: string;
}) {
  // selected workflow ID in explorer
  const [selectedId, setSelectedId] = useState<string|null>(null)
  const [, setBump] = useState(0) // force re-render on mutations (simple mock store)
  const force = () => setBump(x => x+1)

  // Listen to canvas-originated graph updates so list (names) stay in sync
  useEffect(() => {
    function onGraphUpdated(ev: Event) {
      const ce = ev as CustomEvent<{ workflowId: string }>
      if (!ce.detail?.workflowId) return
      // Just bump; store already mutated
      force()
    }
    window.addEventListener('workflowGraphUpdated', onGraphUpdated as EventListener)
    return () => window.removeEventListener('workflowGraphUpdated', onGraphUpdated as EventListener)
  }, [])

  const hasSelection = !!selectedId
  const addWf = () => { if (!propWorkflows) { addWorkflow(selectedId || undefined); force(); } }
  const onAddPlace = () => { if (!selectedId || propWorkflows) return; addPlace(selectedId); force() }
  const onAddTransition = () => { if (!selectedId || propWorkflows) return; addTransition(selectedId); force() }
  const onAddArc = () => { if (!selectedId || propWorkflows) return; addArc(selectedId); force() }

  // Use propWorkflows if provided (server mode), else use mockup workflows
  const workflowList = useMemo(() => {
    if (propWorkflows) {
      // Server: array of { id, name }
      return propWorkflows.map((w: any) => ({ id: w.id, name: w.name }));
    } else {
      // Mockup: object keys
      return Object.keys(workflows).map(id => ({ id, name: workflows[id].name }));
    }
  }, [propWorkflows]);

  return (
    <div style={{ padding: 8, height: '100%', display: 'flex', flexDirection: 'column' }} onClick={() => setSelectedId(null)}>
      {/* tiny toolbar styled with shadcn + lucide to match canvas controls */}
      <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom: 8 }} onClick={(e)=> e.stopPropagation()}>
        <Button size="icon" variant="ghost" onClick={addWf} title={selectedId ? 'Add sub-workflow' : 'Add workflow'} disabled={!!propWorkflows}>
          <FolderPlus className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onAddPlace} title="Add place" disabled={!hasSelection || !!propWorkflows}>
          <CirclePlus className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onAddTransition} title="Add transition" disabled={!hasSelection || !!propWorkflows}>
          <SquarePlus className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onAddArc} title="Add arc" disabled={!hasSelection || !!propWorkflows}>
          <Link2 className="h-4 w-4" />
        </Button>
      </div>

      <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }} onClick={(e)=> e.stopPropagation()}>Workflows</div>
      <div onClick={(e)=> e.stopPropagation()}>
        {workflowList.map(wf => (
          <div
            key={wf.id}
            style={{ fontWeight: selectedId === wf.id ? 'bold' : 'normal', cursor: 'pointer', display:'flex', alignItems:'center', gap:6, padding:'2px 4px', borderRadius:4, background: selectedId === wf.id ? '#f0f0f0' : 'transparent' }}
            onClick={() => {
              setSelectedId(wf.id);
              if (propWorkflows && onWorkflowSelect) onWorkflowSelect(wf.id);
              else force();
            }}
          >
            <Folder className="h-4 w-4" />
            <span>{wf.name}</span>
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }} />
    </div>
  );
}
