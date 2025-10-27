import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const VERSION = "v1"

const getSecret = () => {
  const candidate = process.env.DATASOURCE_SECRET_KEY || process.env.NEXTAUTH_SECRET || process.env.SECRET_KEY_BASE
  if (!candidate || candidate.trim().length === 0) {
    console.warn("[datasource-crypto] Using fallback secret. Set DATASOURCE_SECRET_KEY for stronger security.")
    return "goflow-datasource-fallback-secret"
  }
  return candidate
}

const getKey = () => {
  return crypto.createHash("sha256").update(getSecret()).digest()
}

export async function encrypt(plainText: string): Promise<string> {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  const payload = Buffer.concat([
    Buffer.from(VERSION + ":", "utf8"),
    iv,
    authTag,
    encrypted,
  ])

  return payload.toString("base64")
}

export async function decrypt(payload: string): Promise<string> {
  const buffer = Buffer.from(payload, "base64")
  const versionDelimiterIndex = buffer.indexOf(58) // ':'
  if (versionDelimiterIndex === -1) {
    throw new Error("Invalid ciphertext payload")
  }

  const version = buffer.subarray(0, versionDelimiterIndex).toString("utf8")
  if (version !== VERSION) {
    throw new Error(`Unsupported ciphertext version: ${version}`)
  }

  const content = buffer.subarray(versionDelimiterIndex + 1)
  if (content.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Invalid ciphertext content")
  }

  const iv = content.subarray(0, IV_LENGTH)
  const authTag = content.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = content.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString("utf8")
}

export function parseConnectionUri(
  uri: string,
  type: "mongodb" | "postgres" | "mysql"
): Record<string, string | number | undefined> {
  if (!uri) {
    throw new Error("Connection URI is required")
  }

  let normalizedUri = uri
  if (type === "postgres" && uri.startsWith("postgres://")) {
    normalizedUri = uri.replace(/^postgres:\/\//, "postgresql://")
  }

  const parsed = new URL(normalizedUri)
  const databasePath = parsed.pathname.replace(/^\//, "")

  return {
    host: parsed.hostname || undefined,
    port: parsed.port ? Number(parsed.port) : undefined,
    database: databasePath || undefined,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
  }
}
