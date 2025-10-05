export type Role = 'user' | 'assistant' | 'system' | 'tool'

export interface Attachment {
  url: string
  name?: string
  type?: string
  size?: number
}

export interface ChatMessage {
  _id?: string
  sessionId: string
  role: Role
  content: string
  attachments?: Attachment[]
  createdAt: string | Date
}

export interface ChatSession {
  _id?: string
  sessionId: string
  title?: string
  createdAt: string | Date
  updatedAt: string | Date
}
