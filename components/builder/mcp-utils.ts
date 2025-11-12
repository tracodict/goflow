export interface McpToolState {
  name: string
  description?: string
  enabled: boolean
  passthrough: Record<string, any>
}

export interface McpResourceState {
  name: string
  type: string
  uri?: string
  configText: string
  passthrough: Record<string, any>
}

export interface McpPromptState {
  name: string
  description?: string
  enabled: boolean
  passthrough: Record<string, any>
}

export interface McpResourceTemplateState {
  uri: string
  name?: string
  description?: string
  mimeType?: string
  enabled: boolean
  passthrough: Record<string, any>
}

export interface McpEditorState {
  id: string
  name: string
  baseUrl: string
  type?: 'STDIO' | 'SSE' | 'HTTP'
  timeoutMs?: number
  tools: McpToolState[]
  resources: McpResourceState[]
  prompts: McpPromptState[]
  resourceTemplates: McpResourceTemplateState[]
  passthrough: Record<string, any>
}

export interface McpFile {
  id?: string
  name?: string
  baseUrl?: string
  type?: 'STDIO' | 'SSE' | 'HTTP'
  timeoutMs?: number
  tools?: Array<Record<string, any>>
  resources?: Array<Record<string, any>>
  prompts?: Array<Record<string, any>>
  resourceTemplates?: Array<Record<string, any>>
  [key: string]: any
}

const sanitizeNumber = (value: any): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

const normalizeTool = (value: any): McpToolState => {
  if (typeof value === "string") {
    return {
      name: value,
      description: undefined,
      enabled: true,
      passthrough: {},
    }
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      name: "",
      description: undefined,
      enabled: true,
      passthrough: {},
    }
  }

  const { name, description, enabled, ...rest } = value as Record<string, any>

  return {
    name: typeof name === "string" ? name : "",
    description: typeof description === "string" ? description : undefined,
    enabled: enabled !== false,
    passthrough: { ...rest },
  }
}

const normalizeResource = (value: any): McpResourceState => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      name: "",
      type: "",
      uri: undefined,
      configText: "",
      passthrough: {},
    }
  }

  const { name, type, uri, config, ...rest } = value as Record<string, any>
  let configText = ""

  if (config !== undefined) {
    if (typeof config === "string") {
      configText = config
    } else {
      try {
        configText = JSON.stringify(config, null, 2)
      } catch {
        configText = ""
      }
    }
  }

  return {
    name: typeof name === "string" ? name : "",
    type: typeof type === "string" ? type : "",
    uri: typeof uri === "string" ? uri : undefined,
    configText,
    passthrough: { ...rest },
  }
}

const normalizePrompt = (value: any): McpPromptState => {
  if (typeof value === "string") {
    return {
      name: value,
      description: undefined,
      enabled: true,
      passthrough: {},
    }
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      name: "",
      description: undefined,
      enabled: true,
      passthrough: {},
    }
  }

  const { name, description, enabled, ...rest } = value as Record<string, any>

  return {
    name: typeof name === "string" ? name : "",
    description: typeof description === "string" ? description : undefined,
    enabled: enabled !== false,
    passthrough: { ...rest },
  }
}

const normalizeResourceTemplate = (value: any): McpResourceTemplateState => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      uri: "",
      name: undefined,
      description: undefined,
      mimeType: undefined,
      enabled: true,
      passthrough: {},
    }
  }

  const { uri, name, description, mimeType, enabled, ...rest } = value as Record<string, any>

  return {
    uri: typeof uri === "string" ? uri : "",
    name: typeof name === "string" ? name : undefined,
    description: typeof description === "string" ? description : undefined,
    mimeType: typeof mimeType === "string" ? mimeType : undefined,
    enabled: enabled !== false,
    passthrough: { ...rest },
  }
}

export const createDefaultMcpEditorState = (fileId: string): McpEditorState => ({
  id: fileId,
  name: fileId,
  baseUrl: "",
  timeoutMs: 8000,
  tools: [],
  resources: [],
  prompts: [],
  resourceTemplates: [],
  passthrough: {},
})

export const normalizeMcpFile = (input: any, filePath?: string): McpEditorState => {
  const fileId = filePath ? filePath.split("/").pop()?.replace(/\.mcp$/, "") || "" : ""

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return createDefaultMcpEditorState(fileId)
  }

  const {
    id,
    name,
    baseUrl,
    type,
    timeoutMs,
    timeout_ms,
    timeout,
    tools,
    resources,
    prompts,
    resourceTemplates,
    ...rest
  } = input as Record<string, any>

  const resolvedTimeout = sanitizeNumber(timeoutMs ?? timeout_ms ?? timeout)
  const resolvedType = (type === 'STDIO' || type === 'SSE' || type === 'HTTP') ? type : undefined

  return {
    id: typeof id === "string" && id.trim() ? id : fileId,
    name:
      typeof name === "string" && name.trim()
        ? name
        : typeof id === "string" && id.trim()
        ? id
        : fileId,
    baseUrl: typeof baseUrl === "string" ? baseUrl : "",
    type: resolvedType,
    timeoutMs: resolvedTimeout ?? 8000,
    tools: Array.isArray(tools) ? tools.map(normalizeTool) : [],
    resources: Array.isArray(resources) ? resources.map(normalizeResource) : [],
    prompts: Array.isArray(prompts) ? prompts.map(normalizePrompt) : [],
    resourceTemplates: Array.isArray(resourceTemplates) ? resourceTemplates.map(normalizeResourceTemplate) : [],
    passthrough: { ...rest },
  }
}

const parseResourceConfig = (resource: McpResourceState, index: number): any => {
  const text = resource.configText?.trim() || ""
  if (!text) {
    return undefined
  }

  try {
    return JSON.parse(text)
  } catch (error: any) {
    const label = resource.name?.trim() ? resource.name.trim() : `Resource #${index + 1}`
    const message = typeof error?.message === "string" ? error.message : "Invalid JSON"
    throw new Error(`${label} config JSON invalid: ${message}`)
  }
}

export const validateMcpState = (state: McpEditorState): string[] => {
  const errors: string[] = []
  const base = state.baseUrl?.trim() || ""

  if (!base) {
    errors.push("Base URL is required.")
  } else {
    try {
      new URL(base)
    } catch {
      errors.push("Base URL must be a valid URL.")
    }
  }

  state.tools.forEach((tool, index) => {
    const name = tool.name?.trim() || ""
    if (!name) {
      errors.push(`Tool #${index + 1} is missing a name.`)
    }
  })

  state.resources.forEach((resource, index) => {
    const name = resource.name?.trim() || ""
    if (!name) {
      errors.push(`Resource #${index + 1} is missing a name.`)
    }

    try {
      parseResourceConfig(resource, index)
    } catch (error: any) {
      errors.push(typeof error?.message === "string" ? error.message : String(error))
    }
  })

  state.prompts.forEach((prompt, index) => {
    const name = prompt.name?.trim() || ""
    if (!name) {
      errors.push(`Prompt #${index + 1} is missing a name.`)
    }
  })

  state.resourceTemplates.forEach((template, index) => {
    const uri = template.uri?.trim() || ""
    if (!uri) {
      errors.push(`Resource Template #${index + 1} is missing a URI.`)
    }
  })

  return errors
}

export const serializeMcpState = (state: McpEditorState, filePath: string): McpFile => {
  const errors = validateMcpState(state)
  if (errors.length > 0) {
    throw new Error(errors[0])
  }

  const fileId = filePath.split("/").pop()?.replace(/\.mcp$/, "") || state.id || ""
  const base = state.baseUrl.trim()
  const timeout = sanitizeNumber(state.timeoutMs)

  const tools = state.tools
    .map((tool) => {
      const name = tool.name?.trim() || ""
      if (!name) {
        return null
      }
      const payload: Record<string, any> = { ...tool.passthrough }
      payload.name = name
      if (tool.description?.trim()) {
        payload.description = tool.description.trim()
      }
      payload.enabled = tool.enabled !== false
      return payload
    })
    .filter((tool): tool is Record<string, any> => tool !== null)

  const resources = state.resources
    .map((resource, index) => {
      const name = resource.name?.trim() || ""
      if (!name) {
        return null
      }

      const payload: Record<string, any> = { ...resource.passthrough }
      payload.name = name

      const type = resource.type?.trim()
      if (type) {
        payload.type = type
      }

      const uri = resource.uri?.trim()
      if (uri) {
        payload.uri = uri
      }

      const config = parseResourceConfig(resource, index)
      if (config !== undefined) {
        payload.config = config
      } else if ("config" in payload) {
        delete payload.config
      }

      return payload
    })
    .filter((resource): resource is Record<string, any> => resource !== null)

  const prompts = state.prompts
    .map((prompt) => {
      const name = prompt.name?.trim() || ""
      if (!name) {
        return null
      }
      const payload: Record<string, any> = { ...prompt.passthrough }
      payload.name = name
      if (prompt.description?.trim()) {
        payload.description = prompt.description.trim()
      }
      payload.enabled = prompt.enabled !== false
      return payload
    })
    .filter((prompt): prompt is Record<string, any> => prompt !== null)

  const resourceTemplates = state.resourceTemplates
    .map((template) => {
      const uri = template.uri?.trim() || ""
      if (!uri) {
        return null
      }
      const payload: Record<string, any> = { ...template.passthrough }
      payload.uri = uri
      if (template.name?.trim()) {
        payload.name = template.name.trim()
      }
      if (template.description?.trim()) {
        payload.description = template.description.trim()
      }
      if (template.mimeType?.trim()) {
        payload.mimeType = template.mimeType.trim()
      }
      payload.enabled = template.enabled !== false
      return payload
    })
    .filter((template): template is Record<string, any> => template !== null)

  const result: McpFile = {
    ...state.passthrough,
    id: state.id?.trim() || fileId,
    name: state.name?.trim() || state.id?.trim() || fileId,
    baseUrl: base,
  }

  if (state.type) {
    result.type = state.type
  }

  if (timeout !== undefined) {
    result.timeoutMs = Math.max(0, Math.round(timeout))
  }

  if (tools.length > 0) {
    result.tools = tools
  }

  if (resources.length > 0) {
    result.resources = resources
  }

  if (prompts.length > 0) {
    result.prompts = prompts
  }

  if (resourceTemplates.length > 0) {
    result.resourceTemplates = resourceTemplates
  }

  return result
}
