import { NextRequest, NextResponse } from "next/server"
import { getMongoClient } from "@/lib/server/mongo-client"
import { processMongoSSRM, SSRMRequest } from "@/lib/server/ssrm/mongo"

const DATABASE = process.env.MONGO_DATABASE ?? "goflow"
const COLLECTION = process.env.MONGO_COLLECTION ?? "events"

const parseRequest = async (req: NextRequest): Promise<SSRMRequest> => {
  let body: unknown
  try {
    body = await req.json()
  } catch (error) {
    throw new Error("Unable to parse SSRM request payload")
  }

  if (!body || typeof body !== "object") {
    throw new Error("Invalid SSRM request payload")
  }

  return body as SSRMRequest
}

export async function POST(req: NextRequest) {
  try {
    const [mongoClient, ssrmRequest] = await Promise.all([
      getMongoClient(),
      parseRequest(req),
    ])

    const { basePipeline, ...rest } = ssrmRequest
    const pipeline = Array.isArray(basePipeline) ? basePipeline : []

    const result = await processMongoSSRM(
      {
        client: mongoClient,
        database: rest.database ?? DATABASE,
        collection: rest.collection ?? COLLECTION,
        basePipeline: pipeline,
      },
      rest,
    )

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown SSRM error"
    const status = message.includes("parse") || message.includes("Invalid")
      ? 400
      : message.includes("not supported")
        ? 501
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}
