"use client"
import { Activity, Bot, Brain, Hand, MessageSquare, Wrench } from "lucide-react"
import type { TransitionType } from "@/lib/petri-types"

export function TransitionIcon({ tType, className = "h-4 w-4" }: { tType: TransitionType; className?: string }) {
  switch (tType) {
    case "Manual":
      return <Hand className={className} aria-label="manual" />
    case "Auto":
      return <Bot className={className} aria-label="auto" />
    case "Message":
      return <MessageSquare className={className} aria-label="message" />
    case "LLM":
      return <Brain className={className} aria-label="LLM" />
    case "Tools":
      return <Wrench className={className} aria-label="tools" />
    default:
      return <Activity className={className} aria-label="transition" />
  }
}
