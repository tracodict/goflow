import { MongoClient } from "mongodb"

let clientPromise: Promise<MongoClient> | null = null
let warned = false

const getMongoUri = (): string | undefined => {
  const uri = process.env.MONGO_URI
  if (!uri && !warned) {
    console.warn("[mongo-client] MONGO_URI is not configured; SSRM endpoints will fail.")
    warned = true
  }
  return uri ?? undefined
}

export async function getMongoClient(): Promise<MongoClient> {
  const uri = getMongoUri()
  if (!uri) {
    throw new Error("MONGO_URI environment variable is not defined")
  }

  if (!clientPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      retryWrites: true,
    })

    clientPromise = client.connect().then((connected) => {
      connected.on("close", () => {
        clientPromise = null
      })
      return connected
    })
  }

  return clientPromise
}
