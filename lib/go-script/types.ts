/**
 * Go Script Integration Types
 * 
 * Type definitions for Go script generation, parsing, and execution
 */

export interface ColorDeclaration {
  name: string
  typeDef: string // Go type definition (e.g., "int", "string", "struct{...}")
  jsonSchema?: any // Optional JSON schema for validation
}

export interface GlobalVariable {
  name: string
  type: string // Go type
  initialValue?: string // Go expression
}

export interface FunctionSignature {
  name: string
  params: Array<{ name: string; type: string }>
  returns: Array<{ name?: string; type: string }>
}

export interface TransitionAction extends FunctionSignature {
  transitionId: string
  body?: string // Function body
}

export interface ArcExpression extends FunctionSignature {
  arcId: string
  direction: 'IN' | 'OUT'
  body?: string
}

export interface GuardFunction extends FunctionSignature {
  transitionId: string
  body?: string
}

export interface ParsedGoScript {
  packageName: string
  imports: string[]
  colors: ColorDeclaration[]
  globals: GlobalVariable[]
  transitions: TransitionAction[]
  arcs: ArcExpression[]
  guards: GuardFunction[]
  helpers: Array<{ name: string; signature: string; body: string }>
}

export interface GenerateScriptOptions {
  workflowId: string
  workflowName: string
  colors?: ColorDeclaration[]
  globals?: GlobalVariable[]
  transitions?: TransitionAction[]
  arcs?: ArcExpression[]
  guards?: GuardFunction[]
  preserveHelpers?: boolean
}

export interface ScriptExecutionContext {
  workflowId: string
  pluginPath?: string
  subprocess?: {
    command: string
    args: string[]
  }
}
