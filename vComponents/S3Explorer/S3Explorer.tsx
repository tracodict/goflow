/**
 * S3Explorer Component
 * 
 * Enhanced GCS/S3 explorer component with FileStore API integration.
 * Uses FileStore API for querying GCS buckets and displaying file listings.
 * Supports both saved query execution and ad-hoc folder queries.
 */

import * as React from "react"
import CodeMirror from "@uiw/react-codemirror"
import { json as cmJson } from "@codemirror/lang-json"
import { javascript as cmJavascript } from "@codemirror/lang-javascript"
import { sql as cmSql } from "@codemirror/lang-sql"
import { executeQuery, executeAdhocQuery, type QueryResult } from "../../lib/datastore-client"
import { BaseEventPayload } from "@/lib/component-interface"
import { S3ExplorerEventPayload } from "./interface"
import { useSystemSettings, DEFAULT_SETTINGS } from "@/components/petri/system-settings-context"

const TEXT_PREVIEW_MAX_BYTES = 1024 * 1024 * 2 // 2 MB safeguard for inline previews
const PDF_PREVIEW_MAX_BYTES = 1024 * 1024 * 16 // 16 MB max for inline PDF previews

const TEXTUAL_EXTENSIONS = new Set([
  'txt','md','markdown','csv','tsv','json','yaml','yml','xml','html','htm','css','js','jsx','ts','tsx','c','cpp','h','hpp','java','py','rb','go','rs','php','sql','sh','bash','log','ini','conf'
])

const CODE_EXTENSIONS = new Set([
  'js','jsx','ts','tsx','json','yaml','yml','xml','html','css','sql','py','rb','go','rs','java','c','cpp','h','hpp','php','sh','bash'
])

const KNOWN_URL_FIELDS = [
  'signed_url','signedUrl','download_url','downloadUrl','url','mediaLink','media_link','publicUrl','public_url','preview_url','previewUrl','link','href'
]

const KNOWN_CONTENT_FIELDS = ['content','body','text','preview','snippet']

const KNOWN_BASE64_FIELDS = ['base64','content_base64','body_base64']

const KNOWN_ID_FIELDS = ['id','file_id','fileId','object_id','objectId','storage_id','storageId']

const NESTED_ID_CONTAINERS = ['metadata','file','object','data','attributes','info']

const formatFileSize = (bytes?: number) => {
  if (typeof bytes !== 'number' || Number.isNaN(bytes)) return '—'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, index)
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

const formatDateTime = (value?: string) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

const formatDate = (value?: string) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString()
}

const looksLikeHtml = (value?: string) => {
  if (!value) return false
  const snippet = value.slice(0, 1024)
  if (!snippet) return false
  const trimmed = snippet.trim()
  if (!trimmed) return false
  const lower = trimmed.toLowerCase()
  if (lower.startsWith('<!doctype html')) return true
  return /<\s*(html|head|body|title|meta|link|style|script|div|span)\b/i.test(snippet)
}

const base64ToUint8Array = (value: string): Uint8Array | undefined => {
  try {
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      const binary = window.atob(value)
      const len = binary.length
      const bytes = new Uint8Array(len)
      for (let i = 0; i < len; i += 1) {
        bytes[i] = binary.charCodeAt(i)
      }
      return bytes
    }
    const maybeBuffer = (globalThis as any)?.Buffer
    if (maybeBuffer && typeof maybeBuffer.from === 'function') {
      const buffer = maybeBuffer.from(value, 'base64')
      return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    }
  } catch {}
  return undefined
}

const decodeBase64ToString = (value: string) => {
  const bytes = base64ToUint8Array(value)
  if (!bytes) return undefined
  try {
    if (typeof TextDecoder === 'undefined') return undefined
    const decoder = new TextDecoder('utf-8', { fatal: false })
    return decoder.decode(bytes)
  } catch {}
  return undefined
}

const base64ToBlob = (value: string, contentType: string) => {
  const bytes = base64ToUint8Array(value)
  if (!bytes) return undefined
  try {
    const normalised = new Uint8Array(bytes.length)
    normalised.set(bytes as ArrayLike<number>)
    return new Blob([normalised.buffer], { type: contentType })
  } catch {}
  return undefined
}

const inferContentTypeFromBase64 = (value: string): string | undefined => {
  const bytes = base64ToUint8Array(value)
  if (!bytes || bytes.length < 4) return undefined
  // PDF files start with "%PDF"
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'application/pdf'
  }
  try {
    if (typeof TextDecoder !== 'undefined') {
      const decoder = new TextDecoder('utf-8', { fatal: false })
      const htmlSnippet = decoder.decode(bytes.slice(0, Math.min(bytes.length, 2048)))
      if (looksLikeHtml(htmlSnippet)) {
        return 'text/html'
      }
    }
  } catch {}
  // Attempt a lightweight text detection by checking printable ASCII ratio in first chunk
  let printable = 0
  const sampleLength = Math.min(bytes.length, 64)
  for (let i = 0; i < sampleLength; i += 1) {
    const code = bytes[i]
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126)) {
      printable += 1
    }
  }
  if (sampleLength > 0 && printable / sampleLength > 0.8) {
    return 'text/plain'
  }
  return undefined
}

const pickFirstString = (obj: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    if (typeof obj[key] === 'string' && obj[key]) return obj[key] as string
  }
  return undefined
}

const inferExtension = (fileName: string, path: string, contentType?: string): string | undefined => {
  const fromName = fileName?.split?.('.')
  const nameExt = fromName && fromName.length > 1 ? fromName.pop()!.toLowerCase() : undefined
  if (nameExt) return nameExt
  const fromPath = path?.split?.('.')
  const pathExt = fromPath && fromPath.length > 1 ? fromPath.pop()!.toLowerCase() : undefined
  if (pathExt) return pathExt.split('?')[0]
  if (contentType && contentType.includes('/')) {
    const mimeExt = contentType.split('/').pop()?.split('+')[0]
    return mimeExt || undefined
  }
  return undefined
}

// GCS File item interface (based on FileStore API response)
export interface GCSFile {
  id?: string
  name: string
  path: string
  size: number
  modified?: string
  createdAt?: string
  updatedAt?: string
  type: 'file' | 'folder'
  extension?: string
  content_type?: string
  downloadUrl?: string
  previewUrl?: string
  storagePath?: string
  raw?: Record<string, any>
}

// Component props interface
export interface S3ExplorerProps extends React.HTMLAttributes<HTMLDivElement> {
  // Query execution modes (use one of these)
  queryId?: string        // For saved query execution (/api/queries/:id/run)
  datasourceId?: string   // For ad-hoc queries (legacy compatibility)
  
  // Query parameters
  initialPath?: string
  showHidden?: boolean
  recursive?: boolean
  maxFileSize?: number
  allowedExtensions?: string[]
  
  // Script integration props
  isPreview?: boolean
  elementId?: string
  
  // Event handlers (for script integration)
  onScriptFileSelect?: (payload: S3ExplorerEventPayload) => void
  onScriptFolderToggle?: (payload: S3ExplorerEventPayload) => void
  onScriptDownload?: (payload: S3ExplorerEventPayload) => void
  onScriptError?: (payload: S3ExplorerEventPayload) => void
  onScriptMount?: (payload: BaseEventPayload) => void
  onScriptUnmount?: (payload: BaseEventPayload) => void
}

// S3Explorer component implementation
const S3Explorer = React.forwardRef<HTMLDivElement, S3ExplorerProps>(
  ({ 
    queryId,
    datasourceId,
    initialPath = "/",
    showHidden = false,
    recursive = true,
    maxFileSize = 10485760, // 10MB default
    allowedExtensions = [".md", ".txt", ".json", ".yaml", ".pdf", ".csv", ".xml", ".dat"],
    className,
    style,
    isPreview = false,
    elementId,
    onScriptFileSelect,
    onScriptFolderToggle,
    onScriptDownload,
    onScriptError,
    onScriptMount,
    onScriptUnmount,
    ...props 
  }, ref) => {
    
    // System settings for flowServiceUrl
    const { settings } = useSystemSettings()  
    
    // Local state for this S3Explorer instance
    const [queryResult, setQueryResult] = React.useState<QueryResult | null>(null)
    const [gcsFiles, setGcsFiles] = React.useState<GCSFile[]>([])
    const [running, setRunning] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [currentPath, setCurrentPath] = React.useState(initialPath)
    const [previewFile, setPreviewFile] = React.useState<GCSFile | null>(null)
    const [previewState, setPreviewState] = React.useState<PreviewState>({ status: 'idle' })
    const objectUrlRef = React.useRef<string | null>(null)
    const isPreviewing = previewFile !== null
    
    // Generate element ID
    const finalElementId = elementId || `s3-explorer-${React.useId()}`
    
    // Get flowServiceUrl with fallbacks
    const getFlowServiceUrl = React.useCallback(() => {
      return settings?.flowServiceUrl || DEFAULT_SETTINGS.flowServiceUrl
    }, [settings?.flowServiceUrl])
    
    type PreviewKind = 'code' | 'text' | 'json' | 'pdf' | 'binary' | 'external'

    interface PreviewState {
      status: 'idle' | 'loading' | 'ready' | 'error'
      kind?: PreviewKind
      content?: string
      url?: string
      error?: string
      contentType?: string
    }

    const determinePreviewKind = React.useCallback((file: GCSFile): PreviewKind => {
      if (file.type === 'folder') return 'binary'
      const ext = (file.extension || '').toLowerCase()
      if (ext === 'pdf' || file.content_type?.includes('pdf')) return 'pdf'
      if (ext === 'json' || file.content_type?.includes('json')) return 'json'
      if (CODE_EXTENSIONS.has(ext)) return 'code'
      if (TEXTUAL_EXTENSIONS.has(ext) || (file.content_type || '').startsWith('text/')) return 'text'
      if (file.raw) {
        const inlineContent = pickFirstString(file.raw, KNOWN_CONTENT_FIELDS)
        if (inlineContent && inlineContent.length < TEXT_PREVIEW_MAX_BYTES) {
          return 'text'
        }
      }
      return 'external'
    }, [])

    const resolveFileUrl = React.useCallback((file: GCSFile): string | undefined => {
      if (file.previewUrl) return file.previewUrl
      if (file.downloadUrl) return file.downloadUrl
      if (file.raw) {
        const inlineUrl = pickFirstString(file.raw, KNOWN_URL_FIELDS)
        if (inlineUrl) return inlineUrl
      }
      return undefined
    }, [])

    const resolvePreviewContentType = React.useCallback(
      (file: GCSFile, kind: PreviewKind, provided?: string, options?: { inlineText?: string }) => {
        let type = provided || file.content_type || ''
        let normalised = type.toLowerCase()
        if (normalised === 'application/octet-stream' || normalised === 'binary/octet-stream') {
          type = ''
          normalised = ''
        }

        const inlineText = options?.inlineText
        if ((!type || normalised === 'text/plain') && inlineText && looksLikeHtml(inlineText)) {
          type = 'text/html'
          normalised = 'text/html'
        }

        if (!type) {
          const ext = (file.extension || '').toLowerCase()
          if (kind === 'pdf' || ext === 'pdf') {
            type = 'application/pdf'
          } else if (kind === 'json') {
            type = 'application/json'
          } else if (kind === 'code' || kind === 'text') {
            type = inlineText && looksLikeHtml(inlineText) ? 'text/html' : 'text/plain'
          }
        }

        if (type === 'text/plain' && inlineText && looksLikeHtml(inlineText)) {
          type = 'text/html'
        }

        return type || 'application/octet-stream'
      },
      []
    )

    const extractInlineContent = React.useCallback((file: GCSFile): string | undefined => {
      if (!file.raw) return undefined
      const direct = pickFirstString(file.raw, KNOWN_CONTENT_FIELDS)
      if (direct) return direct
      for (const key of KNOWN_BASE64_FIELDS) {
        const value = file.raw[key]
        if (typeof value === 'string') {
          const decoded = decodeBase64ToString(value)
          if (decoded) return decoded
        }
      }
      return undefined
    }, [])

    const fetchFileText = async (url: string): Promise<{ text: string; contentType?: string }> => {
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        throw new Error(`Failed to load file (${res.status})`)
      }
      const contentType = res.headers.get('content-type') || undefined
      const buffer = await res.arrayBuffer()
      const decoder = new TextDecoder('utf-8', { fatal: false })
      const text = decoder.decode(buffer)
      return { text, contentType }
    }

    const getCodeMirrorExtensions = (kind: PreviewKind, file: GCSFile) => {
      const ex: any[] = []
      const ext = (file.extension || '').toLowerCase()
      if (kind === 'json') {
        ex.push(cmJson())
      } else if (ext === 'sql') {
        ex.push(cmSql())
      } else if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
        ex.push(cmJavascript({ typescript: ext === 'ts' || ext === 'tsx' }))
      }
      return ex
    }

    // Convert QueryResult to GCSFile format
    const parseQueryResultToFiles = React.useCallback((result: QueryResult): GCSFile[] => {
      if (!result.rows || result.rows.length === 0) return []
      
      return result.rows.map((row: any, index: number) => {
        // Handle different possible row formats from GCS queries
        const fileName = row.name || row.key || row.filename || `file_${index}`
        const filePath = row.path || row.key || fileName
  const fileSize = typeof row.size === 'number' ? row.size : (parseInt(row.size) || 0)
  const createdAt = row.created_at || row.createdAt || row.created || row.creation_time || row.timeCreated
  const updatedAt = row.updated_at || row.updatedAt || row.updated || row.timeUpdated || row.lastModified || row.modified
  const lastModified = row.modified || row.lastModified || row.timeModified || updatedAt || createdAt
        const isFolder = row.type === 'folder' || row.isFolder || fileName.endsWith('/')
            const contentType = row.content_type || row.contentType || row.mimeType || (isFolder ? 'folder' : 'application/octet-stream')
            const extension = isFolder ? undefined : inferExtension(fileName, filePath, contentType)
            const downloadUrl = pickFirstString(row, KNOWN_URL_FIELDS)
            const previewUrl = row.preview_url || row.previewUrl || undefined
            let fileId = pickFirstString(row, KNOWN_ID_FIELDS)
            if (!fileId) {
              for (const container of NESTED_ID_CONTAINERS) {
                const nested = row?.[container]
                if (nested && typeof nested === 'object') {
                  fileId = pickFirstString(nested, KNOWN_ID_FIELDS)
                  if (fileId) break
                }
              }
            }
            const storagePath = row.storage_path || row.storagePath || row.full_path || row.fullPath || filePath

        return {
              id: fileId,
          name: fileName,
          path: filePath,
          size: fileSize,
      modified: lastModified,
        createdAt,
        updatedAt,
          type: isFolder ? 'folder' : 'file',
              extension,
              content_type: contentType,
              downloadUrl,
              previewUrl: previewUrl || downloadUrl,
              storagePath,
              raw: row
        }
      })
    }, [])
    
    // Local query function using FileStore API
    const runGCSQuery = React.useCallback(async (path: string) => {
      const flowServiceUrl = getFlowServiceUrl()
      if (!flowServiceUrl) {
        setError('No flow service URL configured')
        return
      }
      
      setRunning(true)
      setError(null)
      
      try {
        let result: QueryResult
        
        if (queryId) {
          // Use saved query execution
          result = await executeQuery(flowServiceUrl, queryId, { 
            folderPath: path,
            recursive,
            includeMetadata: true 
          })
        } else if (datasourceId) {
          // Use ad-hoc query for legacy compatibility
          const queryAst = {
            type: 'folder',
            datasource_id: datasourceId,
            parameters: {
              folderPath: path,
              recursive,
              includeMetadata: true,
              maxFileSize,
              allowedExtensions
            }
          }
          result = await executeAdhocQuery(flowServiceUrl, queryAst, { folderPath: path })
        } else {
          throw new Error('Either queryId or datasourceId must be provided')
        }
        
        setQueryResult(result)
        const files = parseQueryResultToFiles(result)
        setGcsFiles(files)
        
      } catch (e: any) {
        const errorMessage = e?.message || 'GCS query failed'
        setError(errorMessage)
        
        // Trigger error event
        if (isPreview && onScriptError) {
          const payload: S3ExplorerEventPayload = {
            timestamp: Date.now(),
            componentId: finalElementId,
            eventType: 'error',
            datasourceId: datasourceId,
            error: errorMessage
          }
          onScriptError(payload)
        }
      } finally {
        setRunning(false)
      }
    }, [queryId, datasourceId, recursive, maxFileSize, allowedExtensions, getFlowServiceUrl, parseQueryResultToFiles, isPreview, onScriptError, finalElementId])
    
    const extractFileIdentifier = React.useCallback((file: GCSFile): string | undefined => {
      if (file.id) return file.id
      if (file.raw) {
        const direct = pickFirstString(file.raw, KNOWN_ID_FIELDS)
        if (direct) return direct
        for (const container of NESTED_ID_CONTAINERS) {
          const nested = file.raw[container]
          if (nested && typeof nested === 'object') {
            const nestedId = pickFirstString(nested, KNOWN_ID_FIELDS)
            if (nestedId) return nestedId
          }
        }
      }
      return undefined
    }, [])

    const downloadFileViaApi = React.useCallback(async (
      file: GCSFile,
      options?: { includeContent?: boolean; maxBytes?: number }
    ): Promise<{ contentBase64?: string; contentType?: string; downloadUrl?: string }> => {
      const flowServiceUrl = getFlowServiceUrl()
      if (!flowServiceUrl) {
        throw new Error('No flow service URL configured')
      }

      const payload: Record<string, any> = {
        include_content: options?.includeContent ?? true
      }

      if (payload.include_content) {
        payload.max_content_size = options?.maxBytes ?? TEXT_PREVIEW_MAX_BYTES
      }

      const fileId = extractFileIdentifier(file)
      if (fileId) {
        payload.file_id = fileId
      } else if (file.storagePath || file.path) {
        payload.storage_path = file.storagePath || file.path
      } else {
        throw new Error('File identifier not available for download')
      }

      if (datasourceId) {
        payload.datasource_id = datasourceId
      }

      const response = await fetch(`${flowServiceUrl}/api/tools/file/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      let json: any
      try {
        json = await response.json()
      } catch {
        throw new Error('Unable to parse file download response')
      }

      if (!response.ok || !json?.success) {
        const message = json?.error?.message || json?.message || `File download failed (${response.status})`
        throw new Error(message)
      }

      const data = json.data || {}
      return {
        contentBase64: typeof data.content === 'string' ? data.content : undefined,
        contentType: data.content_type || data.mime_type || data.mimeType || file.content_type,
        downloadUrl: data.download_url || data.url || data.signed_url || data.signedUrl
      }
    }, [datasourceId, extractFileIdentifier, getFlowServiceUrl])

    // Trigger query when parameters change
    React.useEffect(() => {
      if (queryId || datasourceId) {
        runGCSQuery(currentPath)
      }
    }, [queryId, datasourceId, currentPath])

    // Load preview content whenever previewFile changes
    React.useEffect(() => {
      if (!previewFile) {
        setPreviewState({ status: 'idle' })
        if (objectUrlRef.current && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(objectUrlRef.current)
          objectUrlRef.current = null
        }
        return
      }

    let cancelled = false
    let activeKind: PreviewKind = determinePreviewKind(previewFile)
    const inlineContent = extractInlineContent(previewFile)
  let contentType = resolvePreviewContentType(previewFile, activeKind, undefined, { inlineText: inlineContent })

      const run = async () => {
  setPreviewState({ status: 'loading', kind: activeKind })

        try {

          if (activeKind === 'code' || activeKind === 'json' || activeKind === 'text') {
            if (previewFile.size && previewFile.size > TEXT_PREVIEW_MAX_BYTES) {
              throw new Error(`File is too large for inline preview (${(previewFile.size / (1024 * 1024)).toFixed(1)} MB)`)
            }

            let textContent = inlineContent
            let sourceUrl = resolveFileUrl(previewFile)

            if (!textContent) {
              try {
                const download = await downloadFileViaApi(previewFile, { includeContent: true, maxBytes: TEXT_PREVIEW_MAX_BYTES })
                const typeHint = download.contentBase64 ? inferContentTypeFromBase64(download.contentBase64) : undefined
                if (typeHint === 'application/pdf') {
                  activeKind = 'pdf'
                }
                if (download.contentBase64) {
                  const decoded = decodeBase64ToString(download.contentBase64)
                  if (decoded) {
                    textContent = decoded
                  }
                }
                if (!sourceUrl && download.downloadUrl) {
                  sourceUrl = download.downloadUrl
                }
                contentType = resolvePreviewContentType(
                  previewFile,
                  activeKind,
                  typeHint || download.contentType || contentType,
                  { inlineText: textContent }
                )
              } catch (apiError) {
                if (!sourceUrl) {
                  throw apiError
                }
              }
            }

            if (!textContent) {
              const url = sourceUrl
              if (!url) {
                throw new Error('No preview content available for this file')
              }
              const result = await fetchFileText(url)
              textContent = result.text
              contentType = resolvePreviewContentType(
                previewFile,
                activeKind,
                result.contentType || contentType,
                { inlineText: textContent }
              )
            }

            if (textContent && typeof contentType === 'string' && contentType.toLowerCase().includes('text/html')) {
              activeKind = 'external'
              let previewUrl = sourceUrl
              if (!previewUrl) {
                if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                  const blob = new Blob([textContent], { type: 'text/html' })
                  if (objectUrlRef.current && typeof URL.revokeObjectURL === 'function') {
                    URL.revokeObjectURL(objectUrlRef.current)
                  }
                  previewUrl = URL.createObjectURL(blob)
                  objectUrlRef.current = previewUrl
                }
                if (!previewUrl) {
                  previewUrl = `data:text/html;charset=utf-8,${encodeURIComponent(textContent)}`
                }
              }
              contentType = 'text/html'
              if (!cancelled) {
                setPreviewState({ status: 'ready', kind: activeKind, url: previewUrl, contentType })
              }
              return
            }

            if (activeKind === 'json' && textContent) {
              try {
                const parsed = JSON.parse(textContent)
                textContent = JSON.stringify(parsed, null, 2)
              } catch {}
            }

            if (!cancelled) {
              setPreviewState({ status: 'ready', kind: activeKind, content: textContent ?? '', url: sourceUrl, contentType })
            }
            return
          }

          let previewUrl = resolveFileUrl(previewFile)

          if (!previewUrl) {
            const fileSize = previewFile.size || 0
            if (activeKind === 'pdf' && fileSize && fileSize > PDF_PREVIEW_MAX_BYTES) {
              throw new Error(`PDF is too large to preview inline (${(fileSize / (1024 * 1024)).toFixed(1)} MB)`)
            }

            const includeContent = activeKind === 'pdf' || fileSize <= TEXT_PREVIEW_MAX_BYTES || fileSize === 0 || (activeKind === 'external' && fileSize <= PDF_PREVIEW_MAX_BYTES)
            const maxBytes = (activeKind === 'pdf' || (activeKind === 'external' && fileSize <= PDF_PREVIEW_MAX_BYTES))
              ? (fileSize && fileSize > 0 ? Math.min(fileSize, PDF_PREVIEW_MAX_BYTES) : PDF_PREVIEW_MAX_BYTES)
              : TEXT_PREVIEW_MAX_BYTES

            const download = await downloadFileViaApi(previewFile, {
              includeContent,
              maxBytes
            })
            const typeHint = download.contentBase64 ? inferContentTypeFromBase64(download.contentBase64) : undefined
            if (typeHint === 'application/pdf') {
              activeKind = 'pdf'
            }
            contentType = resolvePreviewContentType(previewFile, activeKind, typeHint || download.contentType || contentType)
            if (typeof contentType === 'string' && contentType.toLowerCase().includes('text/html')) {
              activeKind = 'external'
            }

            if (download.downloadUrl) {
              previewUrl = download.downloadUrl
            } else if (download.contentBase64) {
              const type = resolvePreviewContentType(previewFile, activeKind, contentType)
              if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                const blob = base64ToBlob(download.contentBase64, type)
                if (blob) {
                  if (objectUrlRef.current && typeof URL.revokeObjectURL === 'function') {
                    URL.revokeObjectURL(objectUrlRef.current)
                  }
                  previewUrl = URL.createObjectURL(blob)
                  objectUrlRef.current = previewUrl
                }
              }
              if (!previewUrl) {
                previewUrl = `data:${type};base64,${download.contentBase64}`
              }
            }
          }

          if (!previewUrl) {
            throw new Error('No preview data available for this file')
          }

          if (!cancelled) {
            const resolvedType = resolvePreviewContentType(previewFile, activeKind, contentType)
            setPreviewState({ status: 'ready', kind: activeKind, url: previewUrl, contentType: resolvedType })
          }
        } catch (err) {
          if (!cancelled) {
            const message = err instanceof Error ? err.message : 'Unable to preview file'
            const fallbackUrl = resolveFileUrl(previewFile)
            const resolvedType = resolvePreviewContentType(previewFile, activeKind, contentType)
            setPreviewState({ status: 'error', kind: activeKind, error: message, url: fallbackUrl, contentType: resolvedType })
          }
        }
      }

      void run()

      return () => {
        cancelled = true
        if (objectUrlRef.current && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(objectUrlRef.current)
          objectUrlRef.current = null
        }
      }
  }, [previewFile, downloadFileViaApi, determinePreviewKind, extractInlineContent, resolveFileUrl, resolvePreviewContentType])
    
    // Handle path navigation
    const navigateToPath = React.useCallback((newPath: string) => {
      setCurrentPath(newPath)
      setPreviewFile(null)
      setPreviewState({ status: 'idle' })
    }, [])
    
    // Handle folder click
    const handleFolderClick = React.useCallback((folder: GCSFile) => {
      if (folder.type === 'folder') {
        const newPath = folder.path.endsWith('/') ? folder.path : `${folder.path}/`
        navigateToPath(newPath)
        
        // Trigger folder toggle event
        if (isPreview && onScriptFolderToggle) {
          const payload: S3ExplorerEventPayload = {
            timestamp: Date.now(),
            componentId: finalElementId,
            eventType: 'folderToggle',
            datasourceId,
            fileName: folder.name,
            filePath: folder.path,
            fileSize: folder.size,
            fileType: folder.content_type,
            isFolder: true,
            action: 'expand'
          }
          onScriptFolderToggle(payload)
        }
      }
    }, [navigateToPath, isPreview, onScriptFolderToggle, finalElementId, datasourceId])
    
    // Handle file selection
    const handleFileSelect = React.useCallback((file: GCSFile) => {
      if (isPreview && onScriptFileSelect) {
        const payload: S3ExplorerEventPayload = {
          timestamp: Date.now(),
          componentId: finalElementId,
          eventType: 'fileSelect',
          datasourceId,
          fileName: file.name,
          filePath: file.path,
          fileSize: file.size,
          fileType: file.content_type,
          isFolder: file.type === 'folder',
          action: 'select'
        }
        onScriptFileSelect(payload)
      }
    }, [isPreview, onScriptFileSelect, finalElementId, datasourceId])

    const handleFilePreview = React.useCallback((file: GCSFile) => {
      setPreviewFile(file)
      if (file.type !== 'folder') {
        handleFileSelect(file)
      }
    }, [handleFileSelect])

    const handleOpenExternal = React.useCallback(async (file: GCSFile) => {
      let targetUrl = resolveFileUrl(file)
      let fileKind: PreviewKind = determinePreviewKind(file)

      try {
        if (!targetUrl) {
          const size = file.size || 0
          if (fileKind === 'pdf' && size && size > PDF_PREVIEW_MAX_BYTES) {
            throw new Error(`PDF is too large to open inline (${(size / (1024 * 1024)).toFixed(1)} MB)`)
          }

          const includeContent = fileKind === 'pdf' || size <= TEXT_PREVIEW_MAX_BYTES || size === 0 || (fileKind === 'external' && size <= PDF_PREVIEW_MAX_BYTES)
          const maxBytes = (fileKind === 'pdf' || (fileKind === 'external' && size <= PDF_PREVIEW_MAX_BYTES))
            ? (size && size > 0 ? Math.min(size, PDF_PREVIEW_MAX_BYTES) : PDF_PREVIEW_MAX_BYTES)
            : TEXT_PREVIEW_MAX_BYTES

          const download = await downloadFileViaApi(file, { includeContent, maxBytes })
          const typeHint = download.contentBase64 ? inferContentTypeFromBase64(download.contentBase64) : undefined
          if (typeHint === 'application/pdf') {
            fileKind = 'pdf'
          }
          let inlineText: string | undefined
          if (download.contentBase64 && (!typeHint || typeHint.startsWith('text/') || typeHint === 'text/plain')) {
            inlineText = decodeBase64ToString(download.contentBase64)
          }
          const resolvedType = resolvePreviewContentType(file, fileKind, typeHint || download.contentType, { inlineText })
          if (resolvedType && resolvedType.toLowerCase().includes('text/html')) {
            fileKind = 'external'
          }

          targetUrl = download.downloadUrl
          if (!targetUrl && download.contentBase64) {
            targetUrl = `data:${resolvedType};base64,${download.contentBase64}`
          }
        }

        if (!targetUrl) {
          throw new Error('Download URL unavailable for this file')
        }

        if (typeof window !== 'undefined') {
          window.open(targetUrl, '_blank', 'noopener,noreferrer')
        }

        if (isPreview && onScriptDownload) {
          const payload: S3ExplorerEventPayload = {
            timestamp: Date.now(),
            componentId: finalElementId,
            eventType: 'download',
            datasourceId,
            fileName: file.name,
            filePath: file.path,
            fileSize: file.size,
            fileType: file.content_type,
            isFolder: false,
            action: 'download'
          }
          onScriptDownload(payload)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Download failed'
        setPreviewState({ status: 'error', error: message, kind: fileKind })
      }
    }, [datasourceId, determinePreviewKind, downloadFileViaApi, finalElementId, isPreview, onScriptDownload, resolveFileUrl, resolvePreviewContentType])
    
    // Handle component mount/unmount events
    React.useEffect(() => {
      if (isPreview && onScriptMount) {
        const payload: BaseEventPayload = {
          timestamp: Date.now(),
          componentId: finalElementId,
          eventType: 'mount'
        }
        onScriptMount(payload)
      }
      
      return () => {
        if (isPreview && onScriptUnmount) {
          const payload: BaseEventPayload = {
            timestamp: Date.now(),
            componentId: finalElementId,
            eventType: 'unmount'
          }
          onScriptUnmount(payload)
        }
      }
    }, [isPreview, onScriptMount, onScriptUnmount, finalElementId])
    
    // Handle errors
    React.useEffect(() => {
      if (error && isPreview && onScriptError) {
        const payload: S3ExplorerEventPayload = {
          timestamp: Date.now(),
          componentId: finalElementId,
          eventType: 'error',
          datasourceId,
          error
        }
        onScriptError(payload)
      }
    }, [error, isPreview, onScriptError, finalElementId, datasourceId])

    return (
      <div 
        ref={ref}
        className={`space-y-4 ${className || ''}`}
        style={style}
        data-element-id={finalElementId}
        {...props}
      >
        {/* Header with current path */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-medium text-gray-700 break-words">
            {isPreviewing && previewFile ? (
              <span>
                🔍 {previewFile.name}
                <span className="ml-2 text-xs text-gray-500">
                  {(previewFile.size / 1024).toFixed(1)} KB
                </span>
              </span>
            ) : (
              <span>📁 {currentPath}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm">
            {isPreviewing && previewFile ? (
              <>
                <button
                  onClick={() => {
                    setPreviewFile(null)
                    setPreviewState({ status: 'idle' })
                  }}
                  className="rounded border border-gray-200 px-2 py-1 hover:bg-gray-50"
                >
                  Back to list
                </button>
                <button
                  onClick={() => previewFile && void handleOpenExternal(previewFile)}
                  className="rounded border border-gray-200 px-2 py-1 hover:bg-gray-50"
                >
                  Open in new tab
                </button>
              </>
            ) : (
              currentPath !== '/' && (
                <button
                  onClick={() => {
                    const parentPath = currentPath.split('/').slice(0, -2).join('/') + '/'
                    navigateToPath(parentPath === '/' ? '/' : parentPath)
                  }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  ⬆️ Parent
                </button>
              )
            )}
          </div>
        </div>
        
        {isPreviewing ? (
          <div className="border border-gray-200 rounded-md bg-white shadow-sm p-4 space-y-3">
            {previewState.status === 'loading' && (
              <div className="flex items-center space-x-2 text-gray-600">
                <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                <span>Loading preview…</span>
              </div>
            )}

            {previewState.status === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="text-red-700 text-sm">
                  <strong>Preview error:</strong> {previewState.error || 'Unable to render preview.'}
                </div>
                {previewState.url ? (
                  <button
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                    onClick={() => previewFile && void handleOpenExternal(previewFile)}
                  >
                    Try opening in a new tab
                  </button>
                ) : null}
              </div>
            )}

            {previewState.status === 'ready' && previewState.kind && previewFile && (
              <div className="space-y-3">
                {(previewState.kind === 'code' || previewState.kind === 'json' || previewState.kind === 'text') ? (
                  <CodeMirror
                    value={previewState.content || ''}
                    theme="light"
                    height="auto"
                    extensions={getCodeMirrorExtensions(previewState.kind, previewFile)}
                    editable={false}
                    basicSetup={{ lineNumbers: true }}
                  />
                ) : previewState.kind === 'pdf' && previewState.url ? (
                  <iframe
                    src={previewState.url}
                    className="w-full h-[70vh] rounded border"
                    title={`Preview of ${previewFile.name}`}
                  />
                ) : previewState.url ? (
                  <iframe
                    src={previewState.url}
                    className="w-full h-[70vh] rounded border"
                    title={`Preview of ${previewFile.name}`}
                  />
                ) : (
                  <div className="text-sm text-gray-600">
                    Preview not available. Use “Open in new tab” to view this file.
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Loading state */}
            {running && (
              <div className="flex items-center space-x-2 text-gray-600">
                <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                <span>Loading GCS files...</span>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="text-red-700 text-sm">
                  <strong>Error:</strong> {error}
                </div>
              </div>
            )}

            {/* Results display */}
            {!running && gcsFiles.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-gray-600">
                  Found {gcsFiles.length} items
                  {queryResult?.meta?.executionMs && (
                    <span className="ml-2 text-xs text-gray-500">
                      ({queryResult.meta.executionMs}ms)
                    </span>
                  )}
                </div>

                <div className="border border-gray-200 rounded-md divide-y divide-gray-200 max-h-96 overflow-y-auto">
                  {gcsFiles.map((file, index) => (
                    <div
                      key={`${file.path}-${index}`}
                      className={`flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                        file.type === 'folder' ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => {
                        if (file.type === 'folder') {
                          handleFolderClick(file)
                        } else {
                          handleFileSelect(file)
                        }
                      }}
                      onDoubleClick={() => {
                        if (file.type === 'folder') {
                          handleFolderClick(file)
                        } else {
                          handleFilePreview(file)
                        }
                      }}
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <span className="text-lg flex-shrink-0">
                          {file.type === 'folder' ? '📁' : '📄'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {file.name}
                          </div>
                            {file.type === 'file' ? (
                              <div className="text-xs text-gray-500 space-y-1">
                                <div>
                                  {(file.extension || file.content_type || 'file').toUpperCase()} • {formatFileSize(file.size)}
                                  {file.content_type ? ` • ${file.content_type}` : ''}
                                </div>
                                <div>
                                  {`Created ${formatDateTime(file.createdAt) || '—'}`}
                                  {file.updatedAt && formatDateTime(file.updatedAt) && file.updatedAt !== file.createdAt ? ` • Updated ${formatDateTime(file.updatedAt)}` : ''}
                                </div>
                                {file.storagePath ? (
                                  <div className="truncate text-[11px] text-gray-400">
                                    {file.storagePath}
                                  </div>
                                ) : null}
                                {file.id ? (
                                  <div className="truncate text-[11px] text-gray-400">
                                    ID: {file.id}
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500">Folder</div>
                            )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                          {file.type === 'file' ? (
                            <span>{formatDate(file.createdAt) || formatDate(file.modified) || '—'}</span>
                          ) : (
                          <span className="text-blue-600">→</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!running && !error && gcsFiles.length === 0 && (queryId || datasourceId) && (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">📂</div>
                <div className="text-sm">No files found in this location</div>
              </div>
            )}

            {/* No configuration state */}
            {!running && !error && !queryId && !datasourceId && (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">⚙️</div>
                <div className="text-sm">No query or datasource configured</div>
              </div>
            )}
          </>
        )}
      </div>
    )
  }
)

S3Explorer.displayName = "S3Explorer"

export { S3Explorer }