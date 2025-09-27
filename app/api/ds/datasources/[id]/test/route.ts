import { NextResponse } from 'next/server'
import { getDatasourceStore, type Datasource } from '@/lib/datasource-store'

async function testMongo(secret?: Datasource['secret']) {
  // Attempt dynamic import; if not present return DRIVER_MISSING (non-fatal)
  try {
    const started = Date.now()
    const mod = await import('mongodb').catch(()=> null)
    if (!mod) return { ok: false, code: 'DRIVER_MISSING', message: 'mongodb driver not installed' }
    const { MongoClient } = mod as any
    const uri = secret?.uri || (secret?.host ? `mongodb://${secret?.user?`${encodeURIComponent(secret.user)}${secret.password? ':'+encodeURIComponent(secret.password):''}@`:''}${secret?.host}${secret?.port? ':'+secret.port:''}/${secret?.database||'admin'}` : null)
    if (!uri) return { ok: false, code: 'NO_CONFIG', message: 'No connection details provided' }
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 1500 })
    try {
      await client.db(secret?.database || 'admin').command({ ping: 1 })
    } finally { await client.close().catch(()=>{}) }
    return { ok: true, latencyMs: Date.now() - started }
  } catch (e:any) {
    return { ok: false, message: e?.message || 'Test failed' }
  }
}

async function testPostgres(secret?: Datasource['secret']) {
  try {
    const started = Date.now()
    const mod = await import('pg').catch(()=> null)
    if (!mod) return { ok: false, code: 'DRIVER_MISSING', message: 'pg driver not installed' }
    const { Client } = mod as any
    const conf = secret?.uri ? { connectionString: secret.uri } : {
      host: secret?.host,
      port: secret?.port,
      user: secret?.user,
      password: secret?.password,
      database: secret?.database
    }
    if (!conf.connectionString && (!conf.host || !conf.port)) return { ok:false, code:'NO_CONFIG', message:'Missing host/port' }
    const client = new Client(conf)
    try { await client.connect(); await client.query('SELECT 1'); } finally { await client.end().catch(()=>{}) }
    return { ok: true, latencyMs: Date.now() - started }
  } catch (e:any) { return { ok:false, message: e?.message || 'Test failed' } }
}

async function testMySQL(secret?: Datasource['secret']) {
  try {
    const started = Date.now()
    const mod = await import('mysql2/promise').catch(()=> null)
    if (!mod) return { ok: false, code: 'DRIVER_MISSING', message: 'mysql2 driver not installed' }
    const mysql = mod as any
    const conf = secret?.uri ? { uri: secret.uri } : {
      host: secret?.host,
      port: secret?.port,
      user: secret?.user,
      password: secret?.password,
      database: secret?.database
    }
    if (!conf.uri && (!conf.host || !conf.port)) return { ok:false, code:'NO_CONFIG', message:'Missing host/port' }
    const conn = conf.uri ? await mysql.createConnection(conf.uri) : await mysql.createConnection(conf)
    try { await conn.query('SELECT 1'); } finally { await conn.end().catch(()=>{}) }
    return { ok: true, latencyMs: Date.now() - started }
  } catch (e:any) { return { ok:false, message: e?.message || 'Test failed' } }
}

async function testS3(secret?: Datasource['secret'], config?: any) {
  try {
    const started = Date.now()
    
    if (!secret?.provider) return { ok: false, code: 'NO_CONFIG', message: 'No S3 provider specified' }
    
    if (secret.provider === 'amazon') {
      if (!secret.accessKey) return { ok: false, code: 'NO_CONFIG', message: 'Missing Access Key' }
      if (!secret.secretKey) return { ok: false, code: 'NO_CONFIG', message: 'Missing Secret Key' }
      if (!secret.region) return { ok: false, code: 'NO_CONFIG', message: 'Missing AWS region' }
    } else if (secret.provider === 'google') {
      // Google Cloud Storage validation and connection test
      if (!secret.serviceAccountKey) return { ok: false, code: 'NO_CONFIG', message: 'Missing Service Account Key' }
      if (!secret.projectId) return { ok: false, code: 'NO_CONFIG', message: 'Missing Project ID' }
      
      try {
        const { Storage } = await import('@google-cloud/storage')
        
        // Parse service account key
        const serviceAccountKey = JSON.parse(secret.serviceAccountKey as string)
        const projectId = secret.projectId || serviceAccountKey.project_id
        
        const storage = new Storage({
          projectId,
          credentials: serviceAccountKey,
        })
        
        // Test connection by checking if we can access the bucket
        const bucketName = config?.bucket
        if (bucketName) {
          const bucket = storage.bucket(bucketName)
          await bucket.exists()
        }
        
        return { ok: true, latencyMs: Date.now() - started, message: 'Google Cloud Storage connection successful' }
      } catch (gcsError: any) {
        return { ok: false, code: 'CONNECTION_FAILED', message: `GCS connection failed: ${gcsError.message}` }
      }
    }
    
    if (!config?.bucket) return { ok: false, code: 'NO_CONFIG', message: 'Missing bucket name' }
    
    // Test actual S3 connection for Amazon provider
    if (secret.provider === 'amazon') {
      try {
        const { S3Client, HeadBucketCommand } = await import('@aws-sdk/client-s3')
        
        const s3Client = new S3Client({
          region: secret.region!,
          credentials: {
            accessKeyId: secret.accessKey!,
            secretAccessKey: secret.secretKey!,
          },
          ...(secret.endpoint ? { endpoint: secret.endpoint } : {}),
        })
        
        // Test connection by checking if bucket exists and is accessible
        await s3Client.send(new HeadBucketCommand({ Bucket: config.bucket }))
        
        return { ok: true, latencyMs: Date.now() - started, message: 'S3 connection successful' }
      } catch (sdkError: any) {
        console.error('[testS3] AWS SDK error:', sdkError)
        return { 
          ok: false, 
          message: `S3 connection failed: ${sdkError.message || 'Unknown error'}`,
          code: sdkError.name || 'S3_ERROR'
        }
      }
    }
    
    return { ok: false, message: 'Unsupported S3 provider for connection test' }
  } catch (e:any) { 
    return { ok: false, message: e?.message || 'S3 test failed' } 
  }
}

export async function POST(
  req: Request,
  ctx: Promise<{ params: { id: string } | Promise<{ id: string }> }> | { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    // Support both legacy synchronous and new promised params shapes.
    const resolved: any = await ctx
    const params: any = await resolved.params // params may itself be a promise per Next.js experimental behavior
    const { id } = params as { id: string }
    
    const store = getDatasourceStore()
    const datasource = await store.findById(id)
    
    if (!datasource) {
      return NextResponse.json({ error: { message: 'Not found' } }, { status: 404 })
    }
    
    let override: any = {}
    try { override = await req.json() } catch {}
    
    // Merge existing secret with any overrides
    const secret = { ...datasource.secret, ...override?.secret }
    
    const run = datasource.type === 'mongo' ? testMongo : 
                datasource.type === 'postgres' ? testPostgres : 
                datasource.type === 'mysql' ? testMySQL : 
                datasource.type === 's3' ? (() => testS3(secret, datasource.configPublic)) : undefined
    
    if (!run) {
      return NextResponse.json({ 
        error: { message: 'Unsupported engine', code: 'UNSUPPORTED' } 
      }, { status: 400 })
    }
    
    const result = await run(secret)
    
    // Update datasource status based on test result
    if (!result.ok) {
      await store.updateStatus(id, 'error', result.message || 'Test failed')
      
      if (result.code === 'DRIVER_MISSING') {
        return NextResponse.json({ 
          error: { message: result.message, code: result.code } 
        }, { status: 501 })
      }
      if (result.code === 'NO_CONFIG') {
        return NextResponse.json({ 
          error: { message: result.message, code: result.code } 
        }, { status: 400 })
      }
      return NextResponse.json({ 
        error: { message: result.message || 'Test failed' } 
      }, { status: 500 })
    }
    
    // Success - update status
    await store.updateStatus(id, 'healthy', undefined, result.latencyMs)
    
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[datasource:test] Error:', error)
    return NextResponse.json({ 
      error: { message: 'Internal test error' } 
    }, { status: 500 })
  }
}
