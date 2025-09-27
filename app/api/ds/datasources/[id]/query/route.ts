import { NextRequest } from 'next/server'
import { getDatasourceStore, type Datasource } from '@/lib/datasource-store'

export async function POST(
  req: NextRequest,
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

    let body: any
    try { 
      body = await req.json() 
    } catch { 
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 }) 
    }

    const started = Date.now()
    try {
      const maxRows = 200
      const maxBytes = 1_000_000 // 1MB safeguard
      let rows: any[] = []
      let columns: { name: string; type?: string }[] = []

      if (datasource.type === 'mongo') {
        const { pipeline } = body
        if (!Array.isArray(pipeline)) {
          return new Response(JSON.stringify({ error: 'pipeline must be an array' }), { status: 400 })
        }
        
        // Handle mock datasources without credentials
        if (!datasource.secret && datasource.id.includes('mock')) {
          if (process.env.GOFLOW_DEBUG) {
            console.log('[query:mongo] returning mock data for', { id: datasource.id, pipelineLen: pipeline.length })
          }
          // Return mock data
          rows = [
            { _id: '507f1f77bcf86cd799439011', name: 'John Doe', email: 'john@example.com', age: 25 },
            { _id: '507f1f77bcf86cd799439012', name: 'Jane Smith', email: 'jane@example.com', age: 30 },
            { _id: '507f1f77bcf86cd799439013', name: 'Bob Johnson', email: 'bob@example.com', age: 35 }
          ]
          columns = [{ name: '_id' }, { name: 'name' }, { name: 'email' }, { name: 'age' }]
        } else {
          const { MongoClient } = await import('mongodb')
          if (!datasource.secret) {
            return new Response(JSON.stringify({ error: 'no credentials configured for datasource' }), { status: 400 })
          }
          
          const uri = datasource.secret?.uri || buildMongoUri(datasource.secret)
          if (process.env.GOFLOW_DEBUG) {
            console.log('[query:mongo] connecting', { 
              id: datasource.id, 
              uri: uri?.replace(/:\/\/(.+?):(.+?)@/, '://***:***@'), 
              pipelineLen: pipeline.length 
            })
          }
          
          const client = new MongoClient(uri as string, { serverSelectionTimeoutMS: 4000 })
          await client.connect()
          const dbName = datasource.secret?.database || datasource.configPublic?.database || 'app'
          const coll = body.collection || datasource.secret?.collection
          
          if (!coll) { 
            await client.close()
            return new Response(JSON.stringify({ error: 'collection required' }), { status: 400 }) 
          }
          
          const cursor = client.db(dbName).collection(coll).aggregate(pipeline, { allowDiskUse: false })
          for await (const doc of cursor) {
            rows.push(doc)
            if (rows.length >= maxRows) break
            if (JSON.stringify(rows).length > maxBytes) break
          }
          await client.close()
          
          // derive columns from first row
          if (rows[0]) columns = Object.keys(rows[0]).map(k => ({ name: k }))
        }
      } else if (datasource.type === 'postgres' || datasource.type === 'mysql') {
        const { sql } = body
        if (typeof sql !== 'string' || !sql.trim()) {
          return new Response(JSON.stringify({ error: 'sql required' }), { status: 400 })
        }
        
        const limited = applyLimit(sql, maxRows)
        const fixedSql = datasource.type === 'postgres' ? fixPostgreSQLCaseSensitivity(limited) : limited
        
        // Handle mock datasources without credentials
        if (!datasource.secret && datasource.id.includes('mock')) {
          if (process.env.GOFLOW_DEBUG) {
            console.log('[query:mock] returning mock data for', { id: datasource.id, type: datasource.type, sql: fixedSql })
          }
          // Return mock data based on basic SQL parsing
          if (sql.toLowerCase().includes('select')) {
            rows = [
              { id: 1, name: 'Alice Johnson', email: 'alice@example.com', created_at: '2024-01-15T10:30:00Z' },
              { id: 2, name: 'Bob Smith', email: 'bob@example.com', created_at: '2024-01-16T14:20:00Z' },
              { id: 3, name: 'Carol Wilson', email: 'carol@example.com', created_at: '2024-01-17T09:45:00Z' }
            ]
            columns = [{ name: 'id' }, { name: 'name' }, { name: 'email' }, { name: 'created_at' }]
          } else {
            // For non-SELECT queries, return a simple result
            rows = [{ result: 'Mock operation completed', affected_rows: 1 }]
            columns = [{ name: 'result' }, { name: 'affected_rows' }]
          }
        } else if (datasource.type === 'postgres') {
          const { Client } = await import('pg')
          if (!datasource.secret) {
            return new Response(JSON.stringify({ error: 'no credentials configured for datasource' }), { status: 400 })
          }
          
          if (process.env.GOFLOW_DEBUG) {
            console.log('[query:pg] connecting', { id: datasource.id, original: limited, fixed: fixedSql })
          }
          
          const client = new Client(buildPgConfig(datasource.secret))
          await client.connect()
          const res = await client.query(fixedSql)
          rows = res.rows.slice(0, maxRows)
          columns = res.fields.map((f: any) => ({ name: f.name }))
          await client.end()
        } else {
          const mysql = await import('mysql2/promise')
          if (!datasource.secret) {
            return new Response(JSON.stringify({ error: 'no credentials configured for datasource' }), { status: 400 })
          }
          
          if (process.env.GOFLOW_DEBUG) {
            console.log('[query:mysql] connecting', { id: datasource.id, limited: fixedSql })
          }
          
          const conn = await mysql.createConnection(buildMysqlConfig(datasource.secret))
          const [res] = await conn.query(fixedSql)
          if (Array.isArray(res)) {
            rows = (res as any[]).slice(0, maxRows)
            if (rows[0]) columns = Object.keys(rows[0]).map(k => ({ name: k }))
          }
          await conn.end()
        }
      } else {
        return new Response(JSON.stringify({ error: 'Unsupported datasource type' }), { status: 400 })
      }

      const executionMs = Date.now() - started
      return Response.json({ columns, rows, meta: { executionMs, datasourceId: datasource.id } })
    } catch (e: any) {
      const executionMs = Date.now() - started
      if (process.env.GOFLOW_DEBUG) {
        console.error('[query:error]', { id: datasource.id, error: e?.message, stack: e?.stack })
      }
      return new Response(JSON.stringify({ 
        error: sanitizeError(e?.message || 'Execution failed'), 
        meta: { executionMs, datasourceId: datasource.id } 
      }), { status: 500 })
    }
  } catch (error: any) {
    console.error('[query] Unexpected error:', error)
    return new Response(JSON.stringify({ error: 'Internal query error' }), { status: 500 })
  }
}

function sanitizeError(msg: string): string {
  if (!msg) return 'Error'
  // Remove potential credentials from URIs
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

function applyLimit(sql: string, maxRows: number) {
  // naive: if user already has limit, keep; else append
  if (/limit\s+\d+/i.test(sql)) return sql
  return sql.replace(/;\s*$/, '') + ` LIMIT ${maxRows}`
}

function fixPostgreSQLCaseSensitivity(sql: string): string {
  // PostgreSQL converts unquoted identifiers to lowercase, but many tables have mixed case
  // This function attempts to quote table/column names that contain uppercase letters
  // to preserve their case in PostgreSQL queries
  
  // Common SQL keywords that should NOT be quoted
  const sqlKeywords = new Set([
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'ON',
    'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT', 'AS',
    'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'ILIKE', 'IS', 'NULL',
    'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX',
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'UNION', 'ALL', 'INTERSECT', 'EXCEPT', 'WITH', 'RECURSIVE'
  ])
  
  // Pattern to match potential identifiers (word boundaries, not already quoted, not followed by '(')
  return sql.replace(/\b([A-Z][a-zA-Z0-9_]*)\b(?![^"]*")(?!\s*\()/g, (match, identifier) => {
    // Don't quote SQL keywords or identifiers that are already lowercase
    if (sqlKeywords.has(identifier.toUpperCase()) || identifier === identifier.toLowerCase()) {
      return match
    }
    
    // Only quote if it contains uppercase letters
    if (/[A-Z]/.test(identifier)) {
      return `"${identifier}"`
    }
    return match
  })
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