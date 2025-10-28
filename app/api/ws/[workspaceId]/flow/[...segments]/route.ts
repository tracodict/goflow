import { NextResponse } from 'next/server'
import { decodeWorkspaceId } from '@/lib/workspace/id'

export const runtime = 'nodejs'

const DEFAULT_FLOW_SERVICE_BASE = process.env.FLOW_SERVICE_URL || process.env.NEXT_PUBLIC_FLOW_SERVICE_URL
const FLOW_UPSTREAM_HEADER = 'x-goflow-upstream-base'
const FLOW_BASE_COOKIE = 'goflow.flowServiceUrl'
const SETTINGS_COOKIE = 'goflow.systemSettings'
const IGNORE_TLS_ERRORS = process.env.IGNORE_TLS_ERRORS === 'true'
if (IGNORE_TLS_ERRORS && typeof process !== 'undefined') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

function normalizeBase(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    if (!parsed.protocol || !/^https?:$/.test(parsed.protocol)) {
      return null
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/u, '')
    return parsed.toString().replace(/\/+$/u, '')
  } catch {
    return null
  }
}

function parseCookieValue(cookieHeader: string | null, key: string): string | null {
  if (!cookieHeader) return null
  const segments = cookieHeader.split(';')
  for (const segment of segments) {
    const [rawKey, ...rest] = segment.split('=')
    if (!rawKey) continue
    if (rawKey.trim() !== key) continue
    const value = rest.join('=')
    if (!value) return null
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }
  return null
}

function resolveBaseUrl(request: Request): string | null {
  const headerBase = normalizeBase(request.headers.get(FLOW_UPSTREAM_HEADER))
  if (headerBase) return headerBase

  const cookieHeader = request.headers.get('cookie')

  const directCookieBase = normalizeBase(parseCookieValue(cookieHeader, FLOW_BASE_COOKIE))
  if (directCookieBase) return directCookieBase

  const settingsPayload = parseCookieValue(cookieHeader, SETTINGS_COOKIE)
  if (settingsPayload) {
    try {
      const parsed = JSON.parse(settingsPayload)
      const candidate = typeof parsed?.flowServiceUrl === 'string' ? parsed.flowServiceUrl : null
      const normalized = normalizeBase(candidate)
      if (normalized) return normalized
    } catch {
      // ignore malformed cookie payloads
    }
  }

  return normalizeBase(DEFAULT_FLOW_SERVICE_BASE)
}

function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) {
  const payload = meta ? { message, ...meta } : { message }
  if (level === 'error') {
    console.error('[flow-proxy]', payload)
  } else if (level === 'warn') {
    console.warn('[flow-proxy]', payload)
  } else if (level === 'info') {
    console.info('[flow-proxy]', payload)
  } else {
    console.debug('[flow-proxy]', payload)
  }
}

type RouteParams = {
  workspaceId: string
  segments?: string[]
}

type ProxyContext = {
  params: RouteParams | Promise<RouteParams>
}

async function proxy(request: Request, context: ProxyContext) {
  const start = Date.now()

  const rawParams = context.params
  const maybePromise = rawParams as RouteParams | Promise<RouteParams>
  const candidate: any = maybePromise
  const isPromise = candidate && typeof candidate.then === 'function'
  const params: RouteParams | undefined = isPromise
    ? await (maybePromise as Promise<RouteParams>)
    : (maybePromise as RouteParams)

  if (!params?.workspaceId) {
    log('error', 'Missing workspace id in flow proxy request', { path: request.url })
    return NextResponse.json({ error: 'Workspace id is required' }, { status: 400 })
  }

  const { workspaceId } = params
  const segments = Array.isArray(params.segments) ? params.segments : []
  const decodedWorkspaceId = (() => {
    try {
      return decodeWorkspaceId(workspaceId)
    } catch (error) {
      log('warn', 'Failed to decode workspace id', { workspaceId, error })
      return workspaceId
    }
  })()

  const base = resolveBaseUrl(request)
  if (!base) {
    log('error', 'Flow service base URL missing', { workspaceId })
    return NextResponse.json({ error: 'Flow service not configured' }, { status: 500 })
  }

  const url = new URL(request.url)
  const normalizedSegments = segments.map((segment) => segment.trim()).filter(Boolean)
  const upstreamSegments = normalizedSegments.length > 0 && normalizedSegments[0] === 'api'
    ? [normalizedSegments[0], 'ws', workspaceId, ...normalizedSegments.slice(1)]
    : ['ws', workspaceId, ...normalizedSegments]
  const upstreamPath = upstreamSegments.join('/')
  const upstreamBase = upstreamPath ? `${base}/${upstreamPath}` : base
  const target = url.search ? `${upstreamBase}${url.search}` : upstreamBase

  const forwardHeaders = new Headers(request.headers)
  forwardHeaders.set('x-goflow-workspace-id', decodedWorkspaceId)
  forwardHeaders.set('x-goflow-encoded-workspace-id', workspaceId)
  forwardHeaders.delete(FLOW_UPSTREAM_HEADER)
  forwardHeaders.delete('host')
  forwardHeaders.delete('connection')
  forwardHeaders.delete('content-length')

  const method = request.method.toUpperCase()
  const cacheTags = [`workspace:${workspaceId}`, `flow:${workspaceId}`]

  const init: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {
    method,
    headers: forwardHeaders,
    redirect: 'manual',
  }

  const cacheable = method === 'GET'
  if (!cacheable) {
    init.cache = 'no-store'
  }
  init.next = { tags: cacheTags, revalidate: cacheable ? 30 : 0 }

  if (!['GET', 'HEAD'].includes(method)) {
    // When forwarding a request body in Node/undici, fetch requires `duplex: 'half'`
    // to allow streaming request bodies. Add duplex only when a body is present.
    init.body = request.body
    try {
      ;(init as any).duplex = 'half'
    } catch {}
  }

  let upstreamResponse: Response
  try {
    upstreamResponse = await fetch(target, init)
  } catch (error: any) {
    const duration = Date.now() - start
    log('error', 'Flow service request failed', {
      workspaceId: decodedWorkspaceId,
      encodedWorkspaceId: workspaceId,
      target,
      method,
      duration,
      error: error?.message || error,
    })
    return NextResponse.json({ error: 'Upstream flow service unreachable' }, { status: 502 })
  }

  const duration = Date.now() - start
  const status = upstreamResponse.status
  const logLevel = status >= 500 ? 'error' : status === 404 ? 'warn' : 'debug'
  log(logLevel, 'Proxied flow service request', {
    workspaceId: decodedWorkspaceId,
    encodedWorkspaceId: workspaceId,
    target,
    method,
    status,
    duration,
  })

  const responseHeaders = new Headers(upstreamResponse.headers)
  responseHeaders.set('x-goflow-flow-proxy', '1')
  responseHeaders.set('x-goflow-workspace-id', decodedWorkspaceId)
  responseHeaders.set('x-goflow-encoded-workspace-id', workspaceId)

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  })
}

export async function GET(request: Request, context: ProxyContext) {
  return proxy(request, context)
}

export async function POST(request: Request, context: ProxyContext) {
  return proxy(request, context)
}

export async function PUT(request: Request, context: ProxyContext) {
  return proxy(request, context)
}

export async function PATCH(request: Request, context: ProxyContext) {
  return proxy(request, context)
}

export async function DELETE(request: Request, context: ProxyContext) {
  return proxy(request, context)
}

export async function HEAD(request: Request, context: ProxyContext) {
  return proxy(request, context)
}

export async function OPTIONS(request: Request, context: ProxyContext) {
  return proxy(request, context)
}
