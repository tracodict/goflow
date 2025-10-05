## AI Chat design (LLM Chat, storage, and persistence)

This document describes the design of the migrated Chat experience (from `ai-chatbot`) integrated into this app, with emphasis on:

- How LLM providers are configured (OpenAI-compatible endpoints and keys)
- How the chat UI collects user input and uploads files
- How the Vercel AI SDK is used to generate streaming responses
- How returned messages are rendered (default Markdown and a structured alt using vComponents + JSON Schema)
- How chat history is persisted (Postgres baseline, MongoDB alternative)
- How files are persisted (Vercel Blob baseline, Google Cloud Storage alternative)

Notes:
- NextAuth is explicitly omitted. The design supports anonymous/guest sessions using a visitor/session id cookie.
- The existing `ai-chatbot/app/(chat)/page.tsx` renders a `Chat` component, sets an `id` per chat instance, selects the model from a cookie (`chat-model`), and streams responses via a `DataStreamHandler`. We keep those core ideas while swapping out auth and persistence backends as needed.

---

### 1) Model configuration (OpenAI-compatible, gateway, and multiple providers)

We rely on the Vercel AI SDK (AI SDK) to call LLMs. The SDK supports:

- Direct provider clients (e.g. OpenAI)
- OpenAI-compatible endpoints (any vendor with the OpenAI REST shape)
- Vercel AI Gateway (one key, many models)

Environment variables (examples):

- Direct OpenAI
	- `OPENAI_API_KEY`: secret key

- OpenAI-compatible (self-hosted or 3rd-party, e.g. LM Studio, OpenRouter-like endpoints)
	- `OPENAI_COMPATIBLE_API_KEY`: API key
	- `OPENAI_COMPATIBLE_BASE_URL`: e.g. `https://your-llm-endpoint/v1`

- Vercel AI Gateway (recommended for aggregating providers)
	- `AI_GATEWAY_API_KEY`: key for gateway
	- Optional: `AI_GATEWAY_BASE_URL` if not using default

Patterns to configure models:

```ts
// lib/llm.ts
import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

const directOpenAI = createOpenAI({
	apiKey: process.env.OPENAI_API_KEY!,
})

// For OpenAI-compatible backends
export const openAICompat = createOpenAI({
	apiKey: process.env.OPENAI_COMPATIBLE_API_KEY!,
	baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL!,
})

// Example: choose a model dynamically from cookie or per-session setting
export function resolveModel(modelId: string) {
	// free-form mapping; examples only
	if (modelId === 'gpt-4o-mini') return directOpenAI('gpt-4o-mini')
	if (modelId === 'compat/llama3.1') return openAICompat('meta-llama/llama-3.1-8b-instruct')
	// fallback
	return directOpenAI('gpt-3.5-turbo')
}
```

If you use the AI Gateway, replace `directOpenAI` with a gateway-configured client (same SDK surface; gateway routes to multiple providers).

Model selection UX: we persist a `chat-model` cookie to remember the current model (mirrors `page.tsx`). If missing, we default to `DEFAULT_CHAT_MODEL`.

---

### 2) Chat UI (messages input and file uploads)

The `Chat` component provides:

- Message composer: a textarea with submit (Enter) and new-line (Shift+Enter)
- File attachments: an upload button supporting multiple files; each file becomes an attachment referenced by URL
- Message list: renders user and assistant messages, with timestamps and optional citations
- Session identity: a generated chat `id` (`generateUUID()`), and a visitor id cookie for anonymous sessions

Interaction flow:

1. User types text and optionally selects files.
2. Files are immediately uploaded to the configured storage (Vercel Blob by default; GCS alternative below) and we store returned URLs.
3. The message + attachments are sent to an API route (e.g. `app/api/chat/route.ts`).
4. The route invokes the LLM via the AI SDK, streams tokens back; the client-side `DataStreamHandler` applies updates live to the thread.

Minimal composer outline:

```tsx
// components/chat/Composer.tsx (conceptual)
export function Composer({ onSubmit }) {
	const [text, setText] = useState('')
	const [files, setFiles] = useState<File[]>([])

	return (
		<form onSubmit={async (e)=>{ e.preventDefault(); await onSubmit({ text, files }); setText(''); setFiles([]); }}>
			<textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Type a message..." />
			<input type="file" multiple onChange={e=>setFiles(Array.from(e.target.files||[]))} />
			<button type="submit">Send</button>
		</form>
	)
}
```

Uploaded file metadata (name, type, size, URL) is attached to the outgoing user message and saved for history.

---

### 3) Using the Vercel AI SDK to generate responses

For streaming responses we use `streamText`:

```ts
// app/api/chat/route.ts
import { NextRequest } from 'next/server'
import { streamText, type CoreMessage } from 'ai'
import { resolveModel } from '@/lib/llm'

export async function POST(req: NextRequest) {
	const { messages, modelId } = await req.json()
	const model = resolveModel(modelId)

	// messages shape matches AI SDK: [{ role: 'user'|'assistant'|'system', content: string }]
	const result = await streamText({ model, messages: messages as CoreMessage[] })
	return result.toDataStreamResponse()
}
```

Client side, the `DataStreamHandler` listens to the stream and incrementally updates the assistant message. This mirrors the `ai-chatbot` pattern: server streams tokens, client appends to the last assistant bubble.

Attachments: if the model supports vision or file inputs, you can pass reference URLs alongside `messages` or use tool-calling to retrieve and embed file content server-side before the `streamText` call.

---

### 4) Rendering returned messages

Default rich-text rendering:

- Render Markdown with code blocks, lists, and tables.
- Add syntax highlighting and copy buttons for fenced code blocks.
- Optional: show “sources” when the message includes a `citations` array.

Structured alternative with vComponents + JSON Schema binding:

- Prompt the model to output JSON conforming to a declared schema (e.g., form sections, cards, tables).
- Validate the JSON and map it into vComponents for guaranteed structure and styling.

Example schema-bound render flow:

1. System prompt: “Respond using the following JSON schema …”
2. Model returns `{ "type": "Card", "props": { "title": "Insights", "children": [...] } }`.
3. Render: `renderVComponent(json, schema)` which selects appropriate React components from `vComponents/` and binds props by schema.

Benefits:

- Deterministic rendering for dashboards, forms, and multi-panel outputs
- Easy to persist and replay

Fallback: If JSON parse fails, display the raw Markdown message.

---

### 5) Persisting chat history (Postgres baseline; MongoDB alternative)

Baseline (Postgres):

Suggested tables (Neon/Postgres):

```sql
create table chat_sessions (
	id uuid primary key default gen_random_uuid(),
	visitor_id text not null,
	title text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table chat_messages (
	id bigserial primary key,
	session_id uuid not null references chat_sessions(id) on delete cascade,
	role text not null check (role in ('user','assistant','system','tool')),
	content text not null,
	attachments jsonb,
	created_at timestamptz not null default now()
);

create index on chat_sessions (visitor_id, updated_at desc);
create index on chat_messages (session_id, created_at);
```

Server route responsibilities:

- On first user message, create a session row and then messages
- For each token stream, at completion, upsert the assistant message
- Update `session.updated_at` after each exchange

Alternative (MongoDB):

Environment: `MONGO_URI` (connection string)

Collections:

- `chat_sessions`: `{ _id:ObjectId, sessionId:string, visitorId:string, title?:string, createdAt:Date, updatedAt:Date }`
- `chat_messages`: `{ _id:ObjectId, sessionId:string, role:'user'|'assistant'|'system'|'tool', content:string, attachments?:[], createdAt:Date }`

Indexes:

```ts
db.chat_sessions.createIndex({ visitorId: 1, updatedAt: -1 })
db.chat_messages.createIndex({ sessionId: 1, createdAt: 1 })
```

Flow is equivalent to Postgres: insert or fetch a session on first message; append messages; update timestamps.

---

### 6) File storage (Vercel Blob baseline; Google Cloud Storage alternative)

Baseline (Vercel Blob):

- Client or server uploads via `@vercel/blob`.
- Returns a public or signed URL; store this URL in message attachments.
- Keep attachment metadata (name, type, size) in the DB with the message.

Example server upload route:

```ts
// app/api/files/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

export async function POST(req: NextRequest) {
	const form = await req.formData()
	const file = form.get('file') as File
	const blob = await put(file.name, file, { access: 'public' })
	return NextResponse.json({ url: blob.url, name: file.name, type: file.type, size: file.size })
}
```

Alternative (Google Cloud Storage):

- Environment:
	- `GCS_KEY`: JSON service account key (raw JSON or base64-encoded JSON)
	- `GCS_BUCKET`: bucket name (defaults to `goflow-chat` if not set)
- On upload, write file to the bucket and return a signed or public URL.

Example server upload route:

```ts
// app/api/files/upload-gcs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Storage } from '@google-cloud/storage'

function getStorage() {
	const raw = process.env.GCS_KEY
	if (!raw) throw new Error('GCS_KEY not configured')
	const creds = (() => { try { return JSON.parse(raw) } catch { return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) } })()
	return new Storage({ credentials: creds })
}

export async function POST(req: NextRequest) {
	const form = await req.formData()
	const file = form.get('file') as File
	const bucket = (process.env.GCS_BUCKET || 'goflow-chat')
	const storage = getStorage()
	const b = storage.bucket(bucket)
	const blob = b.file(file.name)
	await blob.save(Buffer.from(await file.arrayBuffer()), { contentType: file.type, public: true })
	const url = `https://storage.googleapis.com/${bucket}/${encodeURIComponent(file.name)}`
	return NextResponse.json({ url, name: file.name, type: file.type, size: file.size })
}
```

LeftPanel Data tab configuration:

- Provide inputs for `Storage Provider` = `vercel-blob` | `gcs`
- If `gcs`, capture `bucket` and surface whether `GCS_KEY` is present; allow local-only override if needed
- The Chat tab should display current storage provider to set user expectations for attachment visibility

Security notes:

- Validate file type/size; consider antivirus scanning for uploads
- Use signed URLs for private content; expire links for sensitive data
- If using public URLs, ensure users cannot overwrite each other’s files (prefix with session/visitor ids)

---

### Putting it together

At runtime:

1. A new chat `id` is generated for the page; a `visitorId` cookie identifies the browser.
2. The Chat UI lets users type text and upload files; uploads return URLs.
3. Messages (with attachment URLs) are sent to `/api/chat` which calls `streamText` with a model resolved from the `chat-model` cookie or default.
4. The client streams updates into the last assistant message.
5. Completed turns are persisted (Postgres or Mongo), with attachment metadata.
6. On reload, sessions and messages are listed from the database; users can resume where they left off.

This mirrors the approach in `ai-chatbot/app/(chat)/page.tsx` (model cookie, generated chat id, streaming handler) while avoiding NextAuth, and supports multiple storage and database backends via configuration.

