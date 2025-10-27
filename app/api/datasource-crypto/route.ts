import { NextRequest, NextResponse } from "next/server"
import { encrypt, decrypt, parseConnectionUri } from "@/lib/datasource-crypto"

type SupportedAction =
  | "encrypt"
  | "decrypt"
  | "parseUri"
  | "encryptCredentials"
  | "decryptCredentials"

type SupportedDatasourceType = "mongodb" | "postgres" | "mysql"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body as { action?: SupportedAction; data?: Record<string, any> }

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 })
    }

    switch (action) {
      case "encrypt": {
        const text = data?.text
        if (typeof text !== "string") {
          return NextResponse.json({ error: "Invalid text" }, { status: 400 })
        }
        const encrypted = await encrypt(text)
        return NextResponse.json({ encrypted })
      }

      case "decrypt": {
        const text = data?.text
        if (typeof text !== "string") {
          return NextResponse.json({ error: "Invalid text" }, { status: 400 })
        }
        const decrypted = await decrypt(text)
        return NextResponse.json({ decrypted })
      }

      case "parseUri": {
        const uri = data?.uri
        const type = data?.type as SupportedDatasourceType | undefined
        if (typeof uri !== "string" || !type || !["mongodb", "postgres", "mysql"].includes(type)) {
          return NextResponse.json({ error: "Invalid parameters" }, { status: 400 })
        }
        const parsed = parseConnectionUri(uri, type)
        return NextResponse.json({ parsed })
      }

      case "encryptCredentials": {
        const credentials = data?.credentials as Record<string, string> | undefined
        const uri = data?.uri as string | undefined
        const result: Record<string, string> = {}

        if (credentials) {
          for (const key of Object.keys(credentials)) {
            const value = credentials[key]
            if (typeof value === "string" && value.length > 0) {
              result[key] = await encrypt(value)
            }
          }
        }

        if (typeof uri === "string" && uri.length > 0) {
          result.uri = await encrypt(uri)
        }

        return NextResponse.json({ encrypted: result })
      }

      case "decryptCredentials": {
        const credentials = data?.credentials as Record<string, string> | undefined
        const uri = data?.uri as string | undefined
        const result: Record<string, string> = {}

        if (credentials) {
          for (const key of Object.keys(credentials)) {
            const value = credentials[key]
            if (typeof value === "string" && value.length > 0) {
              try {
                result[key] = await decrypt(value)
              } catch (error) {
                console.warn(`[datasource-crypto] Failed to decrypt credential ${key}:`, error)
                result[key] = value
              }
            }
          }
        }

        if (typeof uri === "string" && uri.length > 0) {
          try {
            result.uri = await decrypt(uri)
          } catch (error) {
            console.warn("[datasource-crypto] Failed to decrypt URI:", error)
            result.uri = uri
          }
        }

        return NextResponse.json({ decrypted: result })
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error: unknown) {
    console.error("[datasource-crypto] API error:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
