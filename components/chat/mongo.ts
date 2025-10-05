import { MongoClient, Db } from 'mongodb'

let client: MongoClient | null = null
let db: Db | null = null

const uri = process.env.MONGO_URI

export async function getDb(): Promise<Db> {
  if (!uri) throw new Error('MONGO_URI not configured')
  if (db) return db
  if (!client) client = new MongoClient(uri, { maxPoolSize: 5 })
  await client.connect()
  db = client.db()
  return db
}

export async function ensureIndexes() {
  const database = await getDb()
  await database.collection('chat_sessions').createIndex({ sessionId: 1 }, { unique: true })
  await database.collection('chat_sessions').createIndex({ updatedAt: -1 })
  await database.collection('chat_messages').createIndex({ sessionId: 1, createdAt: 1 })
}
