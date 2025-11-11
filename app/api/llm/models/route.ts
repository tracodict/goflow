import { NextResponse } from 'next/server'
import { getAvailableModels } from '@/components/chat/llm'

export const runtime = 'nodejs'

/**
 * GET /api/llm/models - Get available LLM models
 * Returns the list of configured models from all providers
 */
export async function GET() {
  try {
    const models = getAvailableModels()
    
    return NextResponse.json({
      success: true,
      data: models
    })
  } catch (error: any) {
    console.error('[llm/models] Failed to get models:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || 'Failed to get models',
        data: []
      },
      { status: 500 }
    )
  }
}
