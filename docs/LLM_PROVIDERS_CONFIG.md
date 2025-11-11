# Multi-Provider LLM Configuration

The chat system now supports multiple LLM providers with dynamic configuration through environment variables.

## Architecture

The LLM provider system has a **client/server split architecture**:

- **Server-side** (`llm.ts`): 
  - Reads environment variables to configure providers
  - Creates AI SDK model instances
  - Used in API routes and Server Components
  
- **Client-side** (React components):
  - Fetches model list from `/api/llm/models` endpoint
  - Displays models in UI (Composer, Chat)
  - Sends model name to server for inference

This split ensures **API keys never reach the client** while still providing a dynamic model selector UI.

## Configuration

### 1. Define Providers

Set the `LLM_PROVIDERS` environment variable with a comma-separated list of provider names:

```bash
LLM_PROVIDERS=groq,openai,anthropic
```

### 2. Configure Each Provider

For each provider, set the following environment variables:

#### Base URL
```bash
{PROVIDER}_BASE_URL=https://api.provider.com/v1
```

#### API Key
```bash
{PROVIDER}_API_KEY=your-api-key-here
```

#### Available Models
Comma-separated list of model IDs. Optionally include custom labels using `id:label` format:

```bash
{PROVIDER}_MODELS=model-1,model-2:Custom Label,model-3
```

### Example Configuration

```bash
# Define providers
LLM_PROVIDERS=groq,openai

# Groq configuration
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_API_KEY=gsk_your_groq_api_key
GROQ_MODELS=llama-3.1-70b-versatile:Llama 3.1 70B,llama-3.1-8b-instant:Llama 3.1 8B,mixtral-8x7b-32768:Mixtral 8x7B

# OpenAI configuration
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-your_openai_api_key
OPENAI_MODELS=gpt-4o:GPT-4 Omni,gpt-4-turbo:GPT-4 Turbo,gpt-3.5-turbo:GPT-3.5 Turbo
```

## Model Naming Convention

Models are referenced using the format: `provider/model-id`

Examples:
- `groq/llama-3.1-70b-versatile`
- `openai/gpt-4o`
- `anthropic/claude-3-5-sonnet-20241022`

If no provider prefix is used, the first configured provider is assumed.

## Migration from Old Configuration

### Old Environment Variables (Deprecated)
```bash
OPENAI_COMPATIBLE_API_KEY=...
OPENAI_COMPATIBLE_BASE_URL=...
DEFAULT_CHAT_MODEL=...
```

### New Environment Variables
```bash
LLM_PROVIDERS=groq
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_API_KEY=gsk_...
GROQ_MODELS=llama-3.1-70b-versatile:Llama 3.1 70B,llama-3.1-8b-instant:Llama 3.1 8B
```

## Usage in Code

### Server-Side: Get Available Models

```typescript
import { getAvailableModels } from '@/components/chat/llm'

// Only works server-side (API routes, Server Components, etc.)
const models = getAvailableModels()
// Returns: ModelInfo[] with name, label, and provider
```

### Client-Side: Fetch Available Models

```typescript
import { fetchAvailableModels } from '@/components/chat/llm'

// Works in client components
const models = await fetchAvailableModels()
// Fetches from /api/llm/models endpoint
```

### Server-Side: Resolve Model Instance

```typescript
import { resolveModel } from '@/components/chat/llm'

// Only works server-side (where AI SDK models are used)
// With provider prefix
const model = resolveModel('groq/llama-3.1-70b-versatile')

// Without prefix (uses first provider)
const model = resolveModel('llama-3.1-70b-versatile')

// Default (uses first model of first provider)
const model = resolveModel()
```

## API Endpoints

### GET /api/llm/models

Returns the list of all available models from configured providers.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "groq/llama-3.1-70b-versatile",
      "label": "Llama 3.1 70B",
      "provider": "groq"
    },
    {
      "name": "openai/gpt-4o",
      "label": "GPT-4 Omni",
      "provider": "openai"
    }
  ]
}
```

**Usage:**
```typescript
const res = await fetch('/api/llm/models')
const { data: models } = await res.json()
```

## UI Integration

The Composer and Chat components automatically load available models from the configuration:

1. **Model Selector**: Shows all available models with custom labels
2. **Provider Grouping**: Models are organized by provider
3. **Persistence**: Selected model is saved to localStorage
4. **Validation**: Only configured models can be selected

## Backward Compatibility

The `openAICompat` export is still available for backward compatibility but uses the first configured provider.

## Troubleshooting

### No models available
- Check that `LLM_PROVIDERS` is set
- Verify each provider has `BASE_URL`, `API_KEY`, and `MODELS` configured
- Check console for provider loading warnings

### Model not found
- Ensure model name matches the format in `{PROVIDER}_MODELS`
- Verify provider name in model reference (e.g., `groq/model-name`)
- Check that provider is listed in `LLM_PROVIDERS`

### Provider skipped
Check console logs for warnings like:
```
[llm] Skipping provider groq: missing BASE_URL or API_KEY
[llm] Provider groq has no models configured
```

## Advanced Configuration

### Custom Provider Names
You can use any name for providers:

```bash
LLM_PROVIDERS=mygroq,myopenai
MYGROQ_BASE_URL=...
MYGROQ_API_KEY=...
MYGROQ_MODELS=...
```

### Multiple Instances of Same Provider
```bash
LLM_PROVIDERS=groq-fast,groq-quality
GROQ_FAST_BASE_URL=https://api.groq.com/openai/v1
GROQ_FAST_API_KEY=...
GROQ_FAST_MODELS=llama-3.1-8b-instant:Fast Model

GROQ_QUALITY_BASE_URL=https://api.groq.com/openai/v1
GROQ_QUALITY_API_KEY=...
GROQ_QUALITY_MODELS=llama-3.1-70b-versatile:Quality Model
```

## Model Labels

Model labels support two formats:

1. **Automatic**: Just the model ID
   ```bash
   GROQ_MODELS=llama-3.1-70b-versatile
   # Label: "llama-3.1-70b-versatile"
   ```

2. **Custom**: Use `id:label` format
   ```bash
   GROQ_MODELS=llama-3.1-70b-versatile:Llama 3.1 70B Versatile
   # Label: "Llama 3.1 70B Versatile"
   ```
