import { Storage } from '@google-cloud/storage'

let storage: Storage | null = null

function parseGcsKey(raw?: string) {
  if (!raw) return undefined
  try { return JSON.parse(raw) } catch {
    try { return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) } catch { return undefined }
  }
}

export function getStorage() {
  if (!storage) {
    const creds = parseGcsKey(process.env.GCS_KEY)
    if (!creds) throw new Error('GCS_KEY not configured')
    storage = new Storage({ credentials: creds })
  }
  return storage
}

export function getBucket() {
  const bucket = process.env.GCS_BUCKET || 'goflow-chat'
  return getStorage().bucket(bucket)
}
