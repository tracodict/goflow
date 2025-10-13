import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest"
import { MongoMemoryServer } from "mongodb-memory-server"
import { MongoClient, Document } from "mongodb"
import { processMongoSSRM, SSRMRequest } from "@/lib/server/ssrm/mongo"
import { POST } from "@/app/api/ssrm/route"
import { NextRequest } from "next/server"
import { getMongoClient } from "@/lib/server/mongo-client"

interface TestOrder {
  region: string
  status: string
  sku: string
  amount: number
  quantity: number
  createdAt: Date
}

describe("Mongo SSRM integration", () => {
  let mongoServer: MongoMemoryServer
  let client: MongoClient
  const database = "ssrm_test"
  const collection = "orders"

  const seedData: TestOrder[] = [
    { region: "North", status: "open", sku: "A100", amount: 120, quantity: 4, createdAt: new Date("2024-01-05") },
    { region: "North", status: "open", sku: "A100", amount: 210, quantity: 7, createdAt: new Date("2024-01-08") },
    { region: "North", status: "closed", sku: "A200", amount: 75, quantity: 3, createdAt: new Date("2024-02-14") },
    { region: "South", status: "open", sku: "B100", amount: 410, quantity: 5, createdAt: new Date("2024-03-01") },
    { region: "South", status: "closed", sku: "B200", amount: 90, quantity: 2, createdAt: new Date("2024-03-02") },
    { region: "West", status: "open", sku: "C100", amount: 300, quantity: 6, createdAt: new Date("2024-04-12") },
    { region: "West", status: "closed", sku: "C100", amount: 155, quantity: 3, createdAt: new Date("2024-04-13") },
  ]

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create()
    const uri = mongoServer.getUri()
    process.env.MONGO_URI = uri
    process.env.MONGO_DATABASE = database
    process.env.MONGO_COLLECTION = collection
    client = await MongoClient.connect(uri)
  })

  afterAll(async () => {
    await client.close()
    await mongoServer.stop()
    const cached = await getMongoClient().catch(() => null)
    if (cached) {
      await cached.close()
    }
  })

  beforeEach(async () => {
    const db = client.db(database)
    const coll = db.collection<TestOrder>(collection)
    await coll.deleteMany({})
    await coll.insertMany(seedData)
  })

  it("aggregates rows by region with totals", async () => {
    const request: SSRMRequest = {
      startRow: 0,
      endRow: 100,
      rowGroupCols: [
        { id: "region", displayName: "Region", field: "region" },
      ],
      valueCols: [
        { id: "amount", displayName: "Amount", field: "amount", aggFunc: "sum" },
        { id: "quantity", displayName: "Qty", field: "quantity", aggFunc: "sum" },
      ],
      pivotCols: [],
      pivotMode: false,
      groupKeys: [],
      filterModel: null,
      sortModel: [{ colId: "amount", sort: "desc" }],
    }

    const result = await processMongoSSRM(
      {
        client,
        database,
        collection,
      },
      request,
    )

    expect(result.rows).toHaveLength(3)
    const north = result.rows.find((row) => row.region === "North") as Document
    expect(north.amount).toBe(405)
    expect(north.quantity).toBe(14)
  expect(result.lastRow).toBe(3)
  })

  it("supports pivot mode and returns pivot keys", async () => {
    const request: SSRMRequest = {
      startRow: 0,
      endRow: 100,
      rowGroupCols: [
        { id: "region", displayName: "Region", field: "region" },
      ],
      valueCols: [
        { id: "amount", displayName: "Amount", field: "amount", aggFunc: "sum" },
      ],
      pivotCols: [
        { id: "status", displayName: "Status", field: "status" },
      ],
      pivotMode: true,
      groupKeys: [],
      filterModel: null,
      sortModel: [],
    }

    const result = await processMongoSSRM(
      {
        client,
        database,
        collection,
      },
      request,
    )

    expect(result.pivotKeys.sort()).toEqual(["closed", "open"])
    const north = result.rows.find((row) => row.region === "North") as Document
    expect(north.pivot?.open?.amount).toBe(330)
    expect(north.pivot?.closed?.amount).toBe(75)
  })

  it("handles API route POST requests", async () => {
    const payload: SSRMRequest = {
      startRow: 0,
      endRow: 50,
      rowGroupCols: [
        { id: "region", displayName: "Region", field: "region" },
        { id: "status", displayName: "Status", field: "status" },
      ],
      valueCols: [
        { id: "amount", displayName: "Amount", field: "amount", aggFunc: "sum" },
      ],
      pivotCols: [],
      pivotMode: false,
      groupKeys: [],
      filterModel: null,
      sortModel: [{ colId: "region", sort: "asc" }],
      database,
      collection,
    }

    const request = new NextRequest("http://localhost/api/ssrm", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "content-type": "application/json",
      },
    })

    const response = await POST(request)
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`Route error: ${JSON.stringify(error)}`)
    }
    const json = (await response.json()) as { rows: Document[] }
    expect(json.rows.length).toBe(3)
  })
})
