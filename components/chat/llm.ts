import { createOpenAI } from '@ai-sdk/openai'

// Default to Groq in OpenAI-compatible mode; user can override base URL and key
export const openAICompat = createOpenAI({
  apiKey: process.env.OPENAI_COMPATIBLE_API_KEY || process.env.GROQ_API_KEY || '',
  baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL || process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
})

export function resolveModel(modelId?: string) {
  // Use Groq LLaMA3 as default if unspecified
  const model = (modelId && String(modelId).trim()) || process.env.DEFAULT_CHAT_MODEL || 'openai/gpt-oss-20b'
  return openAICompat(model)
}

export const KNOWN_MODELS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b'
]
