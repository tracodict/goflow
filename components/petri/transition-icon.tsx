"use client"
import { Activity, Bot, Brain, Hand, MessageSquare, TableProperties } from "lucide-react"
import type { TransitionType } from "@/lib/petri-types"

export function TransitionIcon({ tType, className = "h-4 w-4" }: { tType: TransitionType; className?: string }) {
  switch (tType) {
    case "Manual":
      return <Hand className={className} aria-label="manual" />
    case "Auto":
      return <Bot className={className} aria-label="auto" />
    case "Message":
      return <MessageSquare className={className} aria-label="message" />
    case "Dmn":
      return <TableProperties className={className} aria-label="DMN" />
    case "Llm":
      return <Brain className={className} aria-label="LLM" />
    default:
      return <Activity className={className} aria-label="transition" />
  }
}
