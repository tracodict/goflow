"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2 } from "lucide-react"

export type DecisionTable = {
  name?: string
  hitPolicy?: "U" | "F" | "P" | "A" | "R" | "C" | "O"
  inputs: { id: string; label: string; expression: string }[]
  outputs: { id: string; label: string }[]
  rules: { when: string[]; then: string[] }[]
}

function rid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

export function DmnDecisionTable({
  model,
  onChange,
  height = 360,
}: {
  model: DecisionTable
  onChange: (next: DecisionTable) => void
  height?: number
}) {
  const table = useMemo<DecisionTable>(() => {
    const safe = { ...model }
    safe.inputs ||= []
    safe.outputs ||= []
    safe.rules ||= []
    return safe
  }, [model])

  const addInput = () => {
    const next = {
      ...table,
      inputs: [...table.inputs, { id: rid("in"), label: "Input", expression: "" }],
      rules:
        table.rules.length === 0
          ? [{ when: [""], then: table.outputs.map(() => "") }]
          : table.rules.map((r) => ({ ...r, when: [...r.when, ""] })),
    }
    onChange(next)
  }

  const addOutput = () => {
    const next = {
      ...table,
      outputs: [...table.outputs, { id: rid("out"), label: "Output" }],
      rules:
        table.rules.length === 0
          ? [{ when: table.inputs.map(() => ""), then: [""] }]
          : table.rules.map((r) => ({ ...r, then: [...r.then, ""] })),
    }
    onChange(next)
  }

  const removeInput = (idx: number) => {
    const nextInputs = table.inputs.filter((_, i) => i !== idx)
    const nextRules = table.rules.map((r) => ({ ...r, when: r.when.filter((_, i) => i !== idx) }))
    onChange({ ...table, inputs: nextInputs, rules: nextRules })
  }

  const removeOutput = (idx: number) => {
    const nextOutputs = table.outputs.filter((_, i) => i !== idx)
    const nextRules = table.rules.map((r) => ({ ...r, then: r.then.filter((_, i) => i !== idx) }))
    onChange({ ...table, outputs: nextOutputs, rules: nextRules })
  }

  const addRule = () => {
    onChange({
      ...table,
      rules: [...table.rules, { when: table.inputs.map(() => ""), then: table.outputs.map(() => "") }],
    })
  }

  const removeRule = (idx: number) => {
    onChange({ ...table, rules: table.rules.filter((_, i) => i !== idx) })
  }

  const updateInputMeta = (idx: number, patch: Partial<{ label: string; expression: string }>) => {
    const nextInputs = table.inputs.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    onChange({ ...table, inputs: nextInputs })
  }

  const updateOutputMeta = (idx: number, patch: Partial<{ label: string }>) => {
    const nextOutputs = table.outputs.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    onChange({ ...table, outputs: nextOutputs })
  }

  const updateCell = (row: number, col: number, isInput: boolean, value: string) => {
    const rules = table.rules.map((r, i) => {
      if (i !== row) return r
      if (isInput) {
        const when = r.when.map((v, j) => (j === col ? value : v))
        return { ...r, when }
      } else {
        const then = r.then.map((v, j) => (j === col ? value : v))
        return { ...r, then }
      }
    })
    onChange({ ...table, rules })
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-end gap-3">
        <div className="grid w-72 gap-1">
          <Label htmlFor="dt-name">Decision Name</Label>
          <Input
            id="dt-name"
            value={table.name || ""}
            onChange={(e) => onChange({ ...table, name: e.target.value })}
            placeholder="Decision name"
          />
        </div>
        <div className="grid w-40 gap-1">
          <Label htmlFor="dt-hit">Hit Policy</Label>
          <select
            id="dt-hit"
            className="h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm"
            value={table.hitPolicy || "U"}
            onChange={(e) => onChange({ ...table, hitPolicy: e.target.value as DecisionTable["hitPolicy"] })}
          >
            <option value="U">Unique</option>
            <option value="F">First</option>
            <option value="P">Priority</option>
            <option value="A">Any</option>
            <option value="R">Rule Order</option>
            <option value="C">Collect</option>
            <option value="O">Output Order</option>
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={addInput}>
            <Plus className="mr-1 h-4 w-4" /> Input
          </Button>
          <Button size="sm" variant="outline" onClick={addOutput}>
            <Plus className="mr-1 h-4 w-4" /> Output
          </Button>
          <Button size="sm" onClick={addRule}>
            <Plus className="mr-1 h-4 w-4" /> Rule
          </Button>
        </div>
      </div>

      <div className="relative overflow-auto rounded border" style={{ height }}>
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-neutral-50">
              {table.inputs.map((inp, i) => (
                <th key={inp.id} className="min-w-48 border-b border-r p-2 align-bottom">
                  <div className="flex items-center justify-between gap-2">
                    <div className="grid flex-1 gap-1">
                      <Input
                        value={inp.label}
                        onChange={(e) => updateInputMeta(i, { label: e.target.value })}
                        placeholder="Input label"
                      />
                      <Input
                        value={inp.expression}
                        onChange={(e) => updateInputMeta(i, { expression: e.target.value })}
                        placeholder="Expression, e.g. amount"
                      />
                    </div>
                    <button
                      className="ml-2 rounded p-1 text-neutral-500 hover:bg-neutral-100"
                      title="Remove input"
                      onClick={() => removeInput(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </th>
              ))}
              {table.outputs.map((out, i) => (
                <th key={out.id} className="min-w-40 border-b border-r p-2 align-bottom">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      value={out.label}
                      onChange={(e) => updateOutputMeta(i, { label: e.target.value })}
                      placeholder="Output label"
                    />
                    <button
                      className="ml-2 rounded p-1 text-neutral-500 hover:bg-neutral-100"
                      title="Remove output"
                      onClick={() => removeOutput(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </th>
              ))}
              <th className="w-10 border-b p-2" aria-label="Rule actions" />
            </tr>
          </thead>
          <tbody>
            {table.rules.length === 0 ? (
              <tr>
                <td
                  className="p-4 text-center text-sm text-neutral-500"
                  colSpan={table.inputs.length + table.outputs.length + 1}
                >
                  No rules yet. Click "Rule" to add your first row.
                </td>
              </tr>
            ) : (
              table.rules.map((r, ri) => (
                <tr key={`r-${ri}`} className="even:bg-neutral-50/30">
                  {table.inputs.map((_, ci) => (
                    <td key={`r${ri}-in${ci}`} className="border-r p-1">
                      <Input
                        value={r.when[ci] ?? ""}
                        onChange={(e) => updateCell(ri, ci, true, e.target.value)}
                        placeholder="e.g. > 1000"
                      />
                    </td>
                  ))}
                  {table.outputs.map((_, ci) => (
                    <td key={`r${ri}-out${ci}`} className="border-r p-1">
                      <Input
                        value={r.then[ci] ?? ""}
                        onChange={(e) => updateCell(ri, ci, false, e.target.value)}
                        placeholder="e.g. approved"
                      />
                    </td>
                  ))}
                  <td className="p-1 text-center">
                    <button
                      className="rounded p-1 text-neutral-500 hover:bg-neutral-100"
                      title="Remove rule"
                      onClick={() => removeRule(ri)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
