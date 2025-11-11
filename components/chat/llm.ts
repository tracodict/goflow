import { createOpenAI } from '@ai-sdk/openai'

export interface ModelInfo {
  name: string
  label: string
  provider: string
}

interface ProviderConfig {
  name: string
  baseURL: string
  apiKey: string
  models: string[]
}

/**
 * Parse LLM_PROVIDERS from environment and load their configurations
 * Format: LLM_PROVIDERS=groq,openai,anthropic
 * Each provider needs:
 * - {PROVIDER}_BASE_URL
 * - {PROVIDER}_API_KEY
 * - {PROVIDER}_MODELS (comma-separated model names)
 * 
 * NOTE: This function only works server-side where process.env is available
 */
function parseProviders(): ProviderConfig[] {
  // Check if we're on the server side
  if (typeof window !== 'undefined') {
    console.warn('[llm] parseProviders called on client side, returning empty array')
    return []
  }
  
  const providersEnv = process.env.LLM_PROVIDERS || 'groq'
  const providerNames = providersEnv.split(',').map(p => p.trim()).filter(Boolean)
  
  const providers: ProviderConfig[] = []
  
  for (const providerName of providerNames) {
    const upperName = providerName.toUpperCase()
    const baseURL = process.env[`${upperName}_BASE_URL`]
    const apiKey = process.env[`${upperName}_API_KEY`]
    const modelsEnv = process.env[`${upperName}_MODELS`] || ''
    
    if (!baseURL || !apiKey) {
      console.warn(`[llm] Skipping provider ${providerName}: missing BASE_URL or API_KEY`)
      continue
    }
    
    const models = modelsEnv.split(',').map(m => m.trim()).filter(Boolean)
    
    if (models.length === 0) {
      console.warn(`[llm] Provider ${providerName} has no models configured`)
      continue
    }
    
    providers.push({
      name: providerName,
      baseURL,
      apiKey,
      models
    })
  }
  
  return providers
}

/**
 * Build the complete model list from all providers
 * Model name format: provider/model-id or just model-id (uses first provider)
 * 
 * NOTE: Server-side only function
 */
export function getAvailableModels(): ModelInfo[] {
  // Return empty array on client side
  if (typeof window !== 'undefined') {
    console.warn('[llm] getAvailableModels called on client side, use /api/llm/models instead')
    return []
  }
  
  const providers = parseProviders()
  const models: ModelInfo[] = []
  
  for (const provider of providers) {
    for (const modelId of provider.models) {
      // Check if model has a custom label (format: "id:label")
      const [id, label] = modelId.includes(':') 
        ? modelId.split(':', 2) 
        : [modelId, modelId]
      
      models.push({
        name: `${provider.name}/${id}`,
        label: label || id,
        provider: provider.name
      })
    }
  }
  
  return models
}

/**
 * Client-side function to fetch available models from API
 */
export async function fetchAvailableModels(): Promise<ModelInfo[]> {
  try {
    const res = await fetch('/api/llm/models')
    const data = await res.json()
    
    if (data.success && Array.isArray(data.data)) {
      return data.data
    }
    
    console.error('[llm] Failed to fetch models:', data.message)
    return []
  } catch (err) {
    console.error('[llm] Error fetching models:', err)
    return []
  }
}

// Cache of provider instances
const providerCache = new Map<string, ReturnType<typeof createOpenAI>>()

/**
 * Get or create OpenAI-compatible client for a provider
 */
function getProviderClient(providerName: string): ReturnType<typeof createOpenAI> | null {
  if (providerCache.has(providerName)) {
    return providerCache.get(providerName)!
  }
  
  const providers = parseProviders()
  const config = providers.find(p => p.name === providerName)
  
  if (!config) {
    console.error(`[llm] Provider ${providerName} not found`)
    return null
  }
  
  const client = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  })
  
  providerCache.set(providerName, client)
  return client
}

/**
 * Resolve model name to AI SDK model instance
 * Model name format: "provider/model-id" or just "model-id"
 * If no provider prefix, uses the first available provider
 */
export function resolveModel(modelName?: string) {
  const providers = parseProviders()
  
  if (providers.length === 0) {
    throw new Error('[llm] No LLM providers configured')
  }
  
  // Default to first model of first provider
  if (!modelName || !modelName.trim()) {
    const defaultProvider = providers[0]
    const defaultModel = defaultProvider.models[0]
    console.log(`[llm] Using default model: ${defaultProvider.name}/${defaultModel}`)
    
    const client = getProviderClient(defaultProvider.name)
    if (!client) {
      throw new Error(`[llm] Failed to create client for ${defaultProvider.name}`)
    }
    return client(defaultModel)
  }
  
  // Parse provider and model from name
  let providerName: string
  let modelId: string
  
  if (modelName.includes('/')) {
    const parts = modelName.split('/', 2)
    providerName = parts[0]
    modelId = parts[1]
  } else {
    // No provider prefix - use first provider
    providerName = providers[0].name
    modelId = modelName
    console.log(`[llm] No provider prefix, using ${providerName}/${modelId}`)
  }
  
  const client = getProviderClient(providerName)
  if (!client) {
    throw new Error(`[llm] Provider ${providerName} not available`)
  }
  
  return client(modelId)
}

// Backward compatibility exports
// Only create client on server side
export const openAICompat = typeof window === 'undefined' 
  ? getProviderClient(parseProviders()[0]?.name || 'groq') 
  : null

