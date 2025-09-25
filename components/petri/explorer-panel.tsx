import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { FolderPlus, Trash2, Folder, ChevronRight, ChevronDown, Plus, X, RefreshCw, FileUp } from 'lucide-react';
import { saveWorkflow } from '@/components/petri/petri-client';
import { useSystemSettings } from '@/components/petri/system-settings-context';

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

interface ExplorerPanelProps {
  workflows?: { id: string; name: string }[]
  workflowMeta?: Record<string, { name: string; description?: string; colorSets: string[] }>
  // nodes/edges kept for backward compatibility; prefer workflowGraphs for per-workflow data
  nodes?: any[]
  edges?: any[]
  workflowGraphs?: Record<string, { nodes: any[]; edges: any[] }>
  activeWorkflowId?: string | null
  onWorkflowSelect?: (id: string) => void
  onCreateWorkflow?: () => void
  onDeleteWorkflow?: (id: string) => void
  onRenameWorkflow?: (id: string, name: string) => void
  onAddPlace?: () => void
  onRenamePlace?: (id: string, name: string) => void
  onDeletePlace?: (id: string) => void
  onAddTransition?: () => void
  onRenameTransition?: (id: string, name: string) => void
  onDeleteTransition?: (id: string) => void
  onDeleteArc?: (id: string) => void
  onSelectEntity?: (kind: 'place'|'transition'|'arc'|'declarations', id: string) => void
  selectedEntity?: { kind: 'place'|'transition'|'arc'|'declarations'; id: string } | null
  onRefreshWorkflows?: () => void
}

export default function ExplorerPanel(props: ExplorerPanelProps) {
  const { workflows, workflowMeta, nodes = [], edges = [], activeWorkflowId, onWorkflowSelect, onCreateWorkflow, onDeleteWorkflow, onRenameWorkflow,
    onAddPlace, onRenamePlace, onDeletePlace, onAddTransition, onRenameTransition, onDeleteTransition, onDeleteArc, onSelectEntity, selectedEntity, onRefreshWorkflows } = props

  const [expandedWf, setExpandedWf] = useState<Record<string, boolean>>({})
  const [groupExpanded, setGroupExpanded] = useState<Record<string, boolean>>({})
  const [hoverId, setHoverId] = useState<string|null>(null)
  const [localSelection, setLocalSelection] = useState<{ kind: string; id: string } | null>(null)
  const [groupHover, setGroupHover] = useState<Record<string, boolean>>({})
  const toggleWf = (id: string) => setExpandedWf(e => {
    const next = { ...e, [id]: !e[id] }
    // when expanding, also select workflow so its nodes/edges/colorSets show
    if (!e[id]) onWorkflowSelect?.(id)
    return next
  })
  const toggleGroup = (wfId: string, group: string) => setGroupExpanded(e => ({ ...e, [wfId+':'+group]: !e[wfId+':'+group] }))

  // Note: Explorer renders many workflows; use per-workflow graphs when available.

  // colorSets editing removed; declarations panel supersedes it

  return (
    <div style={{ padding: 6, height: '100%', display: 'flex', flexDirection: 'column', fontSize: 12 }}>
      <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: '#555', padding: '0 4px', display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ flex:1 }}>Workflows</span>
        <button title="Create workflow" onClick={() => onCreateWorkflow?.()} style={{ display:'flex', alignItems:'center' }}>
          <FolderPlus className="h-3.5 w-3.5 text-neutral-600" />
        </button>
  <ImportWorkflowButton onImported={() => onRefreshWorkflows?.()} />
        <button title="Refresh list" onClick={() => onRefreshWorkflows?.()} style={{ display:'flex', alignItems:'center' }}>
          <RefreshCw className="h-3.5 w-3.5 text-neutral-600" />
        </button>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {workflows?.map(w => {
          const isActive = activeWorkflowId === w.id
          const isExpanded = !!expandedWf[w.id]
          // pick the appropriate graph for this workflow id
          const graph = (props.workflowGraphs && props.workflowGraphs[w.id]) || (isActive ? { nodes, edges } : { nodes: [], edges: [] })
          const wfPlaces = (graph.nodes || []).filter((n: any) => n.type === 'place')
          const wfTransitions = (graph.nodes || []).filter((n: any) => n.type === 'transition')
          const wfArcs = (graph.edges || [])

          return (
            <div key={w.id} style={{ paddingLeft: 2 }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 4px', borderRadius: 4, background: isActive ? '#f0f0f0' : 'transparent' }}
                onMouseEnter={() => setHoverId(w.id)}
                onMouseLeave={() => setHoverId(h => h===w.id ? null : h)}
              >
                <button aria-label={isExpanded ? 'Collapse' : 'Expand'} onClick={() => toggleWf(w.id)} style={{ display:'flex', alignItems:'center', justifyContent:'center', width:16, height:16 }}>
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                <Folder className="h-4 w-4 text-neutral-600" />
                {onRenameWorkflow ? (
                  <RenameableText label={w.name} onRename={(next) => onRenameWorkflow(w.id, next)} className="truncate" />
                ) : <span className="truncate">{w.name}</span>}
                <div style={{ display:'flex', alignItems:'center', gap:4, marginLeft:'auto', opacity: hoverId===w.id ? 1 : 0, transition:'opacity 120ms' }}>
                {onDeleteWorkflow && (
                  <button title="Delete workflow" onClick={(e) => { e.stopPropagation(); onDeleteWorkflow(w.id) }} style={{ display:'flex', alignItems:'center' }}>
                    <Trash2 className="h-3 w-3 text-neutral-500 hover:text-red-600" />
                  </button>
                )}
                <button onClick={() => onWorkflowSelect?.(w.id)} title="Select workflow" style={{ fontSize:10, padding:'0 4px' }} className="text-neutral-500 hover:text-neutral-800">open</button>
                </div>
              </div>
              {isExpanded && (
                <div style={{ marginLeft: 18, marginTop: 2 }}>
                  {/* Declarations row */}
                  <div style={{ marginLeft:16 }}>
                    <div
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'2px 4px', cursor:'pointer', borderRadius:4, background: selectedEntity?.kind==='declarations'? '#e3f2fd':'transparent' }}
                      onClick={() => onSelectEntity?.('declarations', w.id)}
                      onMouseEnter={() => setHoverId('declarations-'+w.id)}
                      onMouseLeave={() => setHoverId(h => h==='declarations-'+w.id? null : h)}
                    >
                      <span style={{ fontWeight:500 }}>declarations</span>
                    </div>
                  </div>
                  {/* Places */}
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer', padding:'2px 0' }}
                      onMouseEnter={() => setGroupHover(h => ({ ...h, [w.id+':places']: true }))}
                      onMouseLeave={() => setGroupHover(h => ({ ...h, [w.id+':places']: false }))}
                    >
                      <button onClick={() => toggleGroup(w.id,'places')} style={{ width:16, height:16, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {groupExpanded[w.id+':places'] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </button>
                      <span style={{ fontWeight:500 }}>places</span>
                      {onAddPlace && groupHover[w.id+':places'] && <button title="Add place" onClick={(e) => { e.stopPropagation(); onAddPlace() }}><Plus className="h-3 w-3" /></button>}
                    </div>
                    {groupExpanded[w.id+':places'] && (
                      <ul style={{ marginLeft: 16 }}>
                        {wfPlaces.length === 0 && <li style={{ color:'#888' }}>empty</li>}
                        {wfPlaces.map(p => {
                          const sel = selectedEntity?.kind==='place' && selectedEntity.id===p.id
                          const localSel = localSelection?.kind === 'place' && localSelection.id === p.id
                          const showDelete = sel || localSel
                          return (
                            <li key={p.id} className="group" style={{ display:'flex', alignItems:'center', gap:4, background: (sel||localSel)? '#e3f2fd':'transparent', borderRadius:4, padding:'1px 4px' }}
                              onClick={() => { setLocalSelection({ kind: 'place', id: p.id }); onSelectEntity?.('place', p.id) }}
                              onMouseEnter={() => { setHoverId(p.id); setLocalSelection({ kind: 'place', id: p.id }) }} onMouseLeave={() => setHoverId(h => h===p.id? null : h)}
                            >
                              <RenameableText label={(p.data?.name)||p.id} onRename={(next)=> onRenamePlace?.(p.id,next)} />
                              {onDeletePlace && (
                                showDelete ? (
                                  <button onClick={(e)=> { e.stopPropagation(); onDeletePlace(p.id) }} style={{ marginLeft:'auto', opacity: 1, transition:'opacity 120ms' }}>
                                    <Trash2 className="h-3 w-3 text-neutral-500 hover:text-red-600" />
                                  </button>
                                ) : (
                                  <div style={{ marginLeft:'auto', width:20 }} />
                                )
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                  {/* Transitions */}
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer', padding:'2px 0' }}
                      onMouseEnter={() => setGroupHover(h => ({ ...h, [w.id+':transitions']: true }))}
                      onMouseLeave={() => setGroupHover(h => ({ ...h, [w.id+':transitions']: false }))}
                    >
                      <button onClick={() => toggleGroup(w.id,'transitions')} style={{ width:16, height:16, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {groupExpanded[w.id+':transitions'] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </button>
                      <span style={{ fontWeight:500 }}>transitions</span>
                      {onAddTransition && groupHover[w.id+':transitions'] && <button title="Add transition" onClick={(e) => { e.stopPropagation(); onAddTransition() }}><Plus className="h-3 w-3" /></button>}
                    </div>
                    {groupExpanded[w.id+':transitions'] && (
                      <ul style={{ marginLeft: 16 }}>
                        {wfTransitions.length === 0 && <li style={{ color:'#888' }}>empty</li>}
                        {wfTransitions.map(t => {
                          const sel = selectedEntity?.kind==='transition' && selectedEntity.id===t.id
                          const localSel = localSelection?.kind === 'transition' && localSelection.id === t.id
                          const tType = (t.data?.tType) || 'Manual'
                          const showDelete = sel || localSel
                          return (
                            <li key={t.id} className="group" style={{ display:'flex', alignItems:'center', gap:4, background: (sel||localSel)? '#e3f2fd':'transparent', borderRadius:4, padding:'1px 4px' }}
                              onClick={() => { setLocalSelection({ kind: 'transition', id: t.id }); onSelectEntity?.('transition', t.id) }}
                              onMouseEnter={() => { setHoverId(t.id); setLocalSelection({ kind: 'transition', id: t.id }) }} onMouseLeave={() => setHoverId(h => h===t.id? null : h)}
                            >
                              <RenameableText label={(t.data?.name)||t.id} onRename={(next)=> onRenameTransition?.(t.id,next)} />
                              <span style={{ fontSize:10, color:'#555', background:'#f5f5f5', padding:'0 4px', borderRadius:3 }}>{tType}</span>
                              {onDeleteTransition && (
                                showDelete ? (
                                  <button onClick={(e)=> { e.stopPropagation(); onDeleteTransition(t.id) }} style={{ marginLeft:'auto', opacity: 1, transition:'opacity 120ms' }}>
                                    <Trash2 className="h-3 w-3 text-neutral-500 hover:text-red-600" />
                                  </button>
                                ) : (
                                  <div style={{ marginLeft:'auto', width:20 }} />
                                )
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                  {/* Arcs */}
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer', padding:'2px 0' }}
                      onMouseEnter={() => setGroupHover(h => ({ ...h, [w.id+':arcs']: true }))}
                      onMouseLeave={() => setGroupHover(h => ({ ...h, [w.id+':arcs']: false }))}
                    >
                      <button onClick={() => toggleGroup(w.id,'arcs')} style={{ width:16, height:16, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {groupExpanded[w.id+':arcs'] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </button>
                      <span style={{ fontWeight:500 }}>arcs</span>
                      {/* Add arc button intentionally removed per requirement */}
                    </div>
                    {groupExpanded[w.id+':arcs'] && (
                      <ul style={{ marginLeft: 16 }}>
                        {wfArcs.length === 0 && <li style={{ color:'#888' }}>empty</li>}
                        {wfArcs.map(a => {
                          const sel = selectedEntity?.kind==='arc' && selectedEntity.id===a.id
                          const localSel = localSelection?.kind === 'arc' && localSelection.id === a.id
                          const showDelete = sel || localSel
                          return (
                            <li key={a.id} className="group" style={{ display:'flex', alignItems:'center', gap:4, background: (sel||localSel)? '#e3f2fd':'transparent', borderRadius:4, padding:'1px 4px' }}
                              onClick={() => { setLocalSelection({ kind: 'arc', id: a.id }); onSelectEntity?.('arc', a.id) }}
                              onMouseEnter={() => { setHoverId(a.id); setLocalSelection({ kind: 'arc', id: a.id }) }} onMouseLeave={() => setHoverId(h => h===a.id? null : h)}
                            >
                              <span>{a.source} → {a.target}</span>
                              {onDeleteArc && (
                                showDelete ? (
                                  <button onClick={(e)=> { e.stopPropagation(); onDeleteArc(a.id) }} style={{ marginLeft:'auto', opacity: 1, transition:'opacity 120ms' }}>
                                    <Trash2 className="h-3 w-3 text-neutral-500 hover:text-red-600" />
                                  </button>
                                ) : (
                                  <div style={{ marginLeft:'auto', width:20 }} />
                                )
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ImportWorkflowButton({ onImported }: { onImported?: () => void }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const resolveServiceUrl = () => {
    try {
      const { settings } = useSystemSettings()
      if (settings?.flowServiceUrl) return settings.flowServiceUrl
    } catch {
      // ignore if provider not present
    }
    if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_FLOW_SERVICE_URL) return process.env.NEXT_PUBLIC_FLOW_SERVICE_URL
    if (typeof window !== 'undefined') {
      const g = (window as any).__goflowServiceBase
      if (g) return g
    }
    return ''
  }

  const onPick = (f: File | null) => {
    setFile(f)
    setError('')
    setText('')
    if (f) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const t = String(e.target?.result || '')
        setText(t)
      }
      reader.readAsText(f)
    }
  }

  const doImport = async () => {
    if (!file) { setError('Select a file first'); return }
    let json: any
    try { json = JSON.parse(text) } catch { setError('Invalid JSON'); return }
    const base = resolveServiceUrl()
    setLoading(true)
    try {
      await saveWorkflow(base, json)
      onImported?.()
      setOpen(false)
      setFile(null)
      setText('')
      setError('')
    } catch (e: any) {
      setError(e?.serverMessage || e?.message || 'Import failed')
    } finally { setLoading(false) }
  }

  return (
    <>
      <button title="Import workflow" onClick={() => setOpen(true)} style={{ display:'flex', alignItems:'center' }}>
        <FileUp className="h-3.5 w-3.5 text-neutral-600" />
      </button>
      {open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.25)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => !loading && setOpen(false)}>
          <div style={{ width:420, maxWidth:'90%', background:'#fff', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.15)', display:'flex', flexDirection:'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', borderBottom:'1px solid #eee' }}>
              <span style={{ fontSize:13, fontWeight:600 }}>Import Workflow</span>
              <button onClick={() => !loading && setOpen(false)} aria-label="Close" style={{ display:'flex', alignItems:'center' }}><X className="h-4 w-4 text-neutral-500" /></button>
            </div>
            <div style={{ padding:12, display:'flex', flexDirection:'column', gap:10 }}>
              <DragAndDropFileArea file={file} onPick={onPick} error={error} text={text} />
            </div>
            <div style={{ padding:'8px 12px', borderTop:'1px solid #eee', display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button disabled={loading} onClick={() => setOpen(false)} style={{ fontSize:12, padding:'4px 10px', border:'1px solid #ccc', borderRadius:4, background:'#fff' }}>Cancel</button>
              <button disabled={loading || !file} onClick={doImport} style={{ fontSize:12, padding:'4px 12px', borderRadius:4, background: loading? '#065f46':'#059669', color:'#fff', border:'none', opacity: (!file||loading)?0.8:1 }}>{loading? 'Importing...' : 'Import'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function DragAndDropFileArea({ file, onPick, error, text }: { file: File | null; onPick: (f: File | null)=>void; error: string; text: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const onFiles = (files: FileList | null) => { if (files && files[0]) onPick(files[0]) }
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(false); onFiles(e.dataTransfer.files) }
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (!dragging) setDragging(true) }
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(false) }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <input ref={inputRef} type="file" accept="application/json,.json" style={{ display:'none' }} onChange={e => onFiles(e.target.files)} />
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        style={{
          border:'2px dashed '+(dragging? '#059669':'#ccc'),
          borderRadius:8,
          padding:'28px 16px',
          textAlign:'center',
          cursor:'pointer',
          background: dragging? 'rgba(5,150,105,0.05)':'#fafafa',
          transition:'border-color 120ms, background 120ms'
        }}
      >
        <div style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>Drop workflow JSON here</div>
        <div style={{ fontSize:11, color:'#555', lineHeight:1.4 }}>
          Drag & drop one JSON file<br/>or <span style={{ color:'#059669', textDecoration:'underline' }}>click to browse</span><br/>
          Accepted: .json (workflow export)
        </div>
        {file && <div style={{ marginTop:10, fontSize:11 }}>Selected: <strong>{file.name}</strong> ({Math.round(file.size/1024)} KB)</div>}
      </div>
      {text && <textarea readOnly value={text.slice(0,2000)} style={{ fontSize:11, fontFamily:'monospace', width:'100%', height:140, padding:6, border:'1px solid #ddd', borderRadius:4, background:'#fff' }} />}
      {error && <div style={{ color:'#b91c1c', fontSize:11 }}>{error}</div>}
    </div>
  )
}
