import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FolderPlus, Trash2, Folder, ChevronRight, ChevronDown, Plus, X, Activity, Bot, Hand, MessageSquare, TableProperties, Brain, RefreshCw } from 'lucide-react';

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
  nodes?: any[]
  edges?: any[]
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
  const toggleWf = (id: string) => setExpandedWf(e => {
    const next = { ...e, [id]: !e[id] }
    // when expanding, also select workflow so its nodes/edges/colorSets show
    if (!e[id]) onWorkflowSelect?.(id)
    return next
  })
  const toggleGroup = (wfId: string, group: string) => setGroupExpanded(e => ({ ...e, [wfId+':'+group]: !e[wfId+':'+group] }))

  // Derive workflow-local items
  const wfPlaces = nodes.filter(n => n.type === 'place')
  const wfTransitions = nodes.filter(n => n.type === 'transition')
  const wfArcs = edges

  // colorSets editing removed; declarations panel supersedes it

  return (
    <div style={{ padding: 6, height: '100%', display: 'flex', flexDirection: 'column', fontSize: 12 }}>
      <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: '#555', padding: '0 4px', display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ flex:1 }}>Workflows</span>
        <button title="Create workflow" onClick={() => onCreateWorkflow?.()} style={{ display:'flex', alignItems:'center' }}>
          <FolderPlus className="h-3.5 w-3.5 text-neutral-600" />
        </button>
        <button title="Refresh list" onClick={() => onRefreshWorkflows?.()} style={{ display:'flex', alignItems:'center' }}>
          <RefreshCw className="h-3.5 w-3.5 text-neutral-600" />
        </button>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {workflows?.map(w => {
          const isActive = activeWorkflowId === w.id
          const isExpanded = !!expandedWf[w.id]
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
                    <div style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer', padding:'2px 0' }}>
                      <button onClick={() => toggleGroup(w.id,'places')} style={{ width:16, height:16, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {groupExpanded[w.id+':places'] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </button>
                      <span style={{ fontWeight:500 }}>places</span>
                      {onAddPlace && <button title="Add place" onClick={(e) => { e.stopPropagation(); onAddPlace() }}><Plus className="h-3 w-3" /></button>}
                    </div>
                    {groupExpanded[w.id+':places'] && (
                      <ul style={{ marginLeft: 16 }}>
                        {wfPlaces.length === 0 && <li style={{ color:'#888' }}>empty</li>}
                        {wfPlaces.map(p => {
                          const sel = selectedEntity?.kind==='place' && selectedEntity.id===p.id
                          return (
                            <li key={p.id} className="group" style={{ display:'flex', alignItems:'center', gap:4, background: sel? '#e3f2fd':'transparent', borderRadius:4, padding:'1px 4px' }}
                              onClick={() => onSelectEntity?.('place', p.id)}
                              onMouseEnter={() => setHoverId(p.id)} onMouseLeave={() => setHoverId(h => h===p.id? null : h)}
                            >
                              <RenameableText label={(p.data?.name)||p.id} onRename={(next)=> onRenamePlace?.(p.id,next)} />
                              {onDeletePlace && (
                                <button onClick={(e)=> { e.stopPropagation(); onDeletePlace(p.id) }} style={{ marginLeft:'auto', opacity: hoverId===p.id ? 1 : 0, transition:'opacity 120ms' }}>
                                  <Trash2 className="h-3 w-3 text-neutral-500 hover:text-red-600" />
                                </button>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                  {/* Transitions */}
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer', padding:'2px 0' }}>
                      <button onClick={() => toggleGroup(w.id,'transitions')} style={{ width:16, height:16, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {groupExpanded[w.id+':transitions'] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </button>
                      <span style={{ fontWeight:500 }}>transitions</span>
                      {onAddTransition && <button title="Add transition" onClick={(e) => { e.stopPropagation(); onAddTransition() }}><Plus className="h-3 w-3" /></button>}
                    </div>
                    {groupExpanded[w.id+':transitions'] && (
                      <ul style={{ marginLeft: 16 }}>
                        {wfTransitions.length === 0 && <li style={{ color:'#888' }}>empty</li>}
                        {wfTransitions.map(t => {
                          const sel = selectedEntity?.kind==='transition' && selectedEntity.id===t.id
                          const tType = (t.data?.tType) || 'Manual'
                          return (
                            <li key={t.id} className="group" style={{ display:'flex', alignItems:'center', gap:4, background: sel? '#e3f2fd':'transparent', borderRadius:4, padding:'1px 4px' }}
                              onClick={() => onSelectEntity?.('transition', t.id)}
                              onMouseEnter={() => setHoverId(t.id)} onMouseLeave={() => setHoverId(h => h===t.id? null : h)}
                            >
                              <RenameableText label={(t.data?.name)||t.id} onRename={(next)=> onRenameTransition?.(t.id,next)} />
                              <span style={{ fontSize:10, color:'#555', background:'#f5f5f5', padding:'0 4px', borderRadius:3 }}>{tType}</span>
                              {onDeleteTransition && (
                                <button onClick={(e)=> { e.stopPropagation(); onDeleteTransition(t.id) }} style={{ marginLeft:'auto', opacity: hoverId===t.id ? 1 : 0, transition:'opacity 120ms' }}>
                                  <Trash2 className="h-3 w-3 text-neutral-500 hover:text-red-600" />
                                </button>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                  {/* Arcs */}
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer', padding:'2px 0' }}>
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
                          return (
                            <li key={a.id} className="group" style={{ display:'flex', alignItems:'center', gap:4, background: sel? '#e3f2fd':'transparent', borderRadius:4, padding:'1px 4px' }}
                              onClick={() => onSelectEntity?.('arc', a.id)}
                              onMouseEnter={() => setHoverId(a.id)} onMouseLeave={() => setHoverId(h => h===a.id? null : h)}
                            >
                              <span>{a.source} → {a.target}</span>
                              {onDeleteArc && (
                                <button onClick={(e)=> { e.stopPropagation(); onDeleteArc(a.id) }} style={{ marginLeft:'auto', opacity: hoverId===a.id ? 1 : 0, transition:'opacity 120ms' }}>
                                  <Trash2 className="h-3 w-3 text-neutral-500 hover:text-red-600" />
                                </button>
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
