import { NextRequest } from 'next/server'
import { getDatasourceStore, type Datasource } from '@/lib/datasource-store'

export async function GET(
  _req: NextRequest,
  ctx: Promise<{ params: { id: string } | Promise<{ id: string }> }> | { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const resolved: any = await ctx
    const params: any = await resolved.params
    const { id } = params as { id: string }
    
    const store = getDatasourceStore()
    const datasource = await store.findById(id)
    
    if (!datasource) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    }
    
    if (process.env.GOFLOW_DEBUG) {
      console.log('[schema] introspect start', { id: datasource.id, type: datasource.type })
    }
    
    try {
      if (datasource.type === 'mongo') {
        // Handle mock datasources without credentials
        if (!datasource.secret && datasource.id.includes('mock')) {
          if (process.env.GOFLOW_DEBUG) {
            console.log('[schema:mongo] returning mock collections for', { id: datasource.id })
          }
          return Response.json({ 
            collections: ['users', 'orders', 'products', 'reviews', 'categories'] 
          })
        }
        
        const { MongoClient } = await import('mongodb')
        const uri = datasource.secret?.uri || buildMongoUri(datasource.secret)
        if (!datasource.secret) {
          return Response.json({ collections: [], error: 'no credentials configured for datasource' }, { status: 400 })
        }
        
        try {
          const client = new MongoClient(uri as string, { serverSelectionTimeoutMS: 3000 })
          await client.connect()
          const dbName = datasource.secret?.database || datasource.configPublic?.database || 'app'
          const collections = await client.db(dbName).listCollections().toArray()
          await client.close()
          
          if (process.env.GOFLOW_DEBUG) {
            console.log('[schema:mongo] collections', { id: datasource.id, count: collections.length })
          }
          
          return Response.json({ collections: collections.map(c => c.name) })
        } catch (e: any) {
          if (process.env.GOFLOW_DEBUG) {
            console.error('[schema:mongo] error', e?.message)
          }
          return Response.json({ 
            collections: [], 
            error: sanitizeError(e?.message || 'Mongo introspection failed') 
          })
        }
      }
      
      if (datasource.type === 'postgres') {
        // Handle mock datasources without credentials
        if (!datasource.secret && datasource.id.includes('mock')) {
          if (process.env.GOFLOW_DEBUG) {
            console.log('[schema:postgres] returning mock tables for', { id: datasource.id })
          }
          return Response.json({ 
            tables: ['users', 'orders', 'products', 'reviews', 'categories', 'order_items'] 
          })
        }
        
        try {
          const { Client } = await import('pg')
          if (!datasource.secret) {
            return Response.json({ tables: [], error: 'no credentials configured for datasource' }, { status: 400 })
          }
          
          const client = new Client(buildPgConfig(datasource.secret))
          await client.connect()
          const res = await client.query(
            "select table_name from information_schema.tables where table_schema='public' order by 1 limit 200"
          )
          await client.end()
          
          if (process.env.GOFLOW_DEBUG) {
            console.log('[schema:pg] tables', { id: datasource.id, count: res.rows.length })
          }
          
          return Response.json({ tables: res.rows.map(r => r.table_name) })
        } catch (e: any) {
          if (process.env.GOFLOW_DEBUG) {
            console.error('[schema:pg] error', e?.message)
          }
          return Response.json({ 
            tables: [], 
            error: sanitizeError(e?.message || 'Postgres introspection failed') 
          })
        }
      }
      
      if (datasource.type === 'mysql') {
        // Handle mock datasources without credentials
        if (!datasource.secret && datasource.id.includes('mock')) {
          if (process.env.GOFLOW_DEBUG) {
            console.log('[schema:mysql] returning mock tables for', { id: datasource.id })
          }
          return Response.json({ 
            tables: ['users', 'orders', 'products', 'reviews', 'categories', 'order_items'] 
          })
        }
        
        try {
          const mysql = await import('mysql2/promise')
          if (!datasource.secret) {
            return Response.json({ tables: [], error: 'no credentials configured for datasource' }, { status: 400 })
          }
          
          const conn = await mysql.createConnection(buildMysqlConfig(datasource.secret))
          const [rows] = await conn.query("SHOW TABLES")
          await conn.end()
          const list = Array.isArray(rows) ? (rows as any[]).map(r => Object.values(r)[0]) : []
          
          if (process.env.GOFLOW_DEBUG) {
            console.log('[schema:mysql] tables', { id: datasource.id, count: list.length })
          }
          
          return Response.json({ tables: list })
        } catch (e: any) {
          if (process.env.GOFLOW_DEBUG) {
            console.error('[schema:mysql] error', e?.message)
          }
          return Response.json({ 
            tables: [], 
            error: sanitizeError(e?.message || 'MySQL introspection failed') 
          })
        }
      }
      
      if (datasource.type === 's3') {
        // Handle mock S3 datasources
        if (!datasource.secret && datasource.id.includes('mock')) {
          if (process.env.GOFLOW_DEBUG) {
            console.log('[schema:s3] returning mock files for', { id: datasource.id })
          }
          return Response.json({ 
            files: ['documents/report.pdf', 'images/logo.png', 'data/users.csv', 'backup/database.sql'] 
          })
        }
        
        try {
          if (!datasource.secret) {
            return Response.json({ files: [], error: 'no credentials configured for datasource' }, { status: 400 })
          }
          
          const bucket = datasource.configPublic?.bucket
          const pathPrefix = datasource.configPublic?.pathPrefix || ''
          const provider = datasource.secret.provider
          
          if (!bucket) {
            return Response.json({ files: [], error: 'no bucket specified' }, { status: 400 })
          }
          
          if (provider === 'amazon' && datasource.secret.accessKey && datasource.secret.secretKey && datasource.secret.region) {
            // Use real AWS S3 API
            try {
              const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3')
              
              const s3Client = new S3Client({
                region: datasource.secret.region!,
                credentials: {
                  accessKeyId: datasource.secret.accessKey!,
                  secretAccessKey: datasource.secret.secretKey!,
                },
                ...(datasource.secret.endpoint ? { endpoint: datasource.secret.endpoint } : {}),
              })
              
              const listCommand = new ListObjectsV2Command({
                Bucket: bucket,
                Prefix: pathPrefix,
                MaxKeys: 200, // Limit results
              })
              
              const result = await s3Client.send(listCommand)
              const files = result.Contents?.map(obj => obj.Key || '') || []
              
              if (process.env.GOFLOW_DEBUG) {
                console.log('[schema:s3] real S3 file listing for', { id: datasource.id, bucket, fileCount: files.length })
              }
              
              return Response.json({ 
                files: files.filter(f => f.trim()),
                bucket,
                pathPrefix,
                totalObjects: result.KeyCount || 0,
                isTruncated: result.IsTruncated || false
              })
            } catch (s3Error: any) {
              console.error('[schema:s3] AWS S3 error:', s3Error)
              return Response.json({ 
                files: [], 
                error: `S3 error: ${s3Error.message || 'Failed to list objects'}`,
                bucket
              })
            }
          } else if (provider === 'google') {
            // Google Cloud Storage implementation
            if (process.env.GOFLOW_DEBUG) {
              console.log('[schema:s3] Using real Google Cloud Storage for', { id: datasource.id, bucket })
            }
            
            try {
              const { Storage } = await import('@google-cloud/storage')
              
              // Parse service account key from secret
              const serviceAccountKey = JSON.parse(datasource.secret.serviceAccountKey as string)
              const projectId = datasource.secret.projectId || serviceAccountKey.project_id
              
              const storage = new Storage({
                projectId,
                credentials: serviceAccountKey,
              })
              
              const bucket_obj = storage.bucket(bucket)
              
              // List files with optional prefix
              const [files] = await bucket_obj.getFiles({
                prefix: pathPrefix || undefined,
                maxResults: 200,
              })
              
              const fileNames = files.map(file => file.name)
              
              if (process.env.GOFLOW_DEBUG) {
                console.log('[schema:s3] real GCS file listing for', { id: datasource.id, bucket, fileCount: fileNames.length })
              }
              
              return Response.json({ 
                files: fileNames,
                bucket,
                pathPrefix,
                totalObjects: fileNames.length,
                provider: 'google'
              })
              
            } catch (gcsError: any) {
              console.error('[schema:s3] Google Cloud Storage error:', gcsError)
              return Response.json({ 
                files: [], 
                error: `GCS error: ${gcsError.message || 'Failed to list objects'}`,
                bucket
              })
            }
          } else {
            return Response.json({ 
              files: [], 
              error: 'Missing S3 credentials or unsupported provider' 
            })
          }
        } catch (e: any) {
          if (process.env.GOFLOW_DEBUG) {
            console.error('[schema:s3] error', e?.message)
          }
          return Response.json({ 
            files: [], 
            error: sanitizeError(e?.message || 'S3 introspection failed') 
          })
        }
      }
      
      return new Response(JSON.stringify({ error: 'Unsupported type' }), { status: 400 })
    } catch (e: any) {
      // Fallback unexpected error; keep 200 so UI doesn't treat it as fatal
      if (process.env.GOFLOW_DEBUG) {
        console.error('[schema] unexpected error', e)
      }
      return Response.json({ 
        collections: [], 
        tables: [], 
        error: sanitizeError(e?.message || 'Failed to introspect') 
      })
    }
  } catch (error: any) {
    console.error('[schema] Request error:', error)
    return Response.json({ 
      collections: [], 
      tables: [], 
      error: 'Internal schema error' 
    }, { status: 500 })
  }
}

function sanitizeError(msg: string) {
  return msg.replace(/:\/\/(.+?):(.+?)@/g, '://***:***@')
}

function buildMongoUri(secret: any) {
  if (secret?.uri) return secret.uri
  const auth = secret?.user ? `${encodeURIComponent(secret.user)}:${encodeURIComponent(secret.password || '')}@` : ''
  const host = secret?.host || 'localhost'
  const port = secret?.port ? `:${secret.port}` : ''
  const db = secret?.database ? `/${secret.database}` : ''
  return `mongodb://${auth}${host}${port}${db}`
}

function buildPgConfig(secret: any) {
  if (secret?.uri) return { connectionString: secret.uri }
  return {
    host: secret?.host,
    port: secret?.port ? Number(secret.port) : undefined,
    user: secret?.user,
    password: secret?.password,
    database: secret?.database
  }
}

function buildMysqlConfig(secret: any) {
  if (secret?.uri) return secret.uri
  return {
    host: secret?.host,
    port: secret?.port ? Number(secret.port) : undefined,
    user: secret?.user,
    password: secret?.password,
    database: secret?.database
  }
}

export const dynamic = 'force-dynamic'