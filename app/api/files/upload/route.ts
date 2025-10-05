import { NextRequest } from 'next/server'
import { getBucket } from '@/components/chat/gcs'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const files = form.getAll('files')
  const bucket = getBucket()
  const uploaded: { url: string; name: string }[] = []
  for (const f of files) {
    if (!(f instanceof File)) continue
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}-${(f as File).name}`
    const file = bucket.file(name)
    const stream = file.createWriteStream({ contentType: (f as File).type, resumable: false, public: true })
    const arrayBuffer = await (f as File).arrayBuffer()
    await new Promise<void>((resolve, reject)=> {
      stream.on('error', reject)
      stream.on('finish', resolve)
      stream.end(Buffer.from(arrayBuffer))
    })
    const url = `https://storage.googleapis.com/${bucket.name}/${name}`
    uploaded.push({ url, name })
  }
  return Response.json({ files: uploaded })
}
