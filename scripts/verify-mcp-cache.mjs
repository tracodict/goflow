#!/usr/bin/env node
/**
 * MCP Cache Verification Script
 * 
 * This script demonstrates the MCP cache functionality:
 * 1. Load sample MCP configurations
 * 2. Query enabled tools and prompts
 * 3. Find specific items
 * 4. Display statistics
 */

import { mcpCache } from '../lib/mcp-cache.js'
import type { McpEditorState } from '../components/builder/mcp-utils.js'

console.log('🚀 MCP Cache Verification\n')

// Sample MCP configuration 1: IBKR Server
const ibkrConfig: McpEditorState = {
  id: 'ibkr-mcp',
  name: 'IBKR MCP Server',
  baseUrl: 'http://localhost:8000/api/v1/mcp',
  timeoutMs: 8000,
  tools: [
    {
      name: 'ibkr_get_market_data',
      description: 'Get real-time market data for a symbol',
      enabled: true,
      passthrough: {}
    },
    {
      name: 'ibkr_place_order',
      description: 'Place a trading order',
      enabled: true,
      passthrough: {}
    }
  ],
  prompts: [
    {
      name: 'market-analysis',
      description: 'Analyze market conditions for a symbol',
      enabled: true,
      passthrough: {
        arguments: [
          { name: 'symbol', description: 'Stock symbol', required: true },
          { name: 'timeframe', description: 'Analysis timeframe', required: false }
        ]
      }
    }
  ],
  resources: [
    {
      name: 'portfolio',
      type: 'api',
      uri: 'ibkr://portfolio/account',
      configText: '',
      passthrough: {}
    }
  ],
  resourceTemplates: [
    {
      uri: 'ibkr://market-data/{symbol}',
      name: 'get_market_data_resource',
      description: 'Real-time market data',
      mimeType: 'application/json',
      enabled: true,
      passthrough: {}
    }
  ],
  passthrough: {}
}

// Sample MCP configuration 2: Code Assistant
const codeAssistantConfig: McpEditorState = {
  id: 'code-assistant',
  name: 'Code Assistant MCP',
  baseUrl: 'http://localhost:9000/mcp',
  timeoutMs: 5000,
  tools: [
    {
      name: 'analyze_code',
      description: 'Analyze code for issues',
      enabled: true,
      passthrough: {}
    },
    {
      name: 'format_code',
      description: 'Format code according to standards',
      enabled: false,  // Disabled
      passthrough: {}
    }
  ],
  prompts: [
    {
      name: 'code-review',
      description: 'Review code for quality and best practices',
      enabled: true,
      passthrough: {
        arguments: [
          { name: 'code', description: 'Code to review', required: true },
          { name: 'language', description: 'Programming language', required: false }
        ]
      }
    }
  ],
  resources: [],
  resourceTemplates: [],
  passthrough: {}
}

async function runVerification() {
  console.log('📦 Step 1: Loading MCP configurations...')
  await mcpCache.loadFromStorage({
    'ibkr.mcp': ibkrConfig,
    'code-assistant.mcp': codeAssistantConfig
  })
  console.log('✅ Loaded successfully\n')

  console.log('📊 Step 2: Cache Statistics')
  const stats = mcpCache.getStats()
  console.log(`   Total Configs: ${stats.totalConfigs}`)
  console.log(`   Total Tools: ${stats.totalTools}`)
  console.log(`   Total Prompts: ${stats.totalPrompts}`)
  console.log(`   Total Resources: ${stats.totalResources}\n`)

  console.log('🔧 Step 3: Enabled Tools')
  const tools = mcpCache.getEnabledTools()
  tools.forEach(tool => {
    console.log(`   - ${tool.name}`)
    console.log(`     Description: ${tool.description}`)
    console.log(`     Base URL: ${tool.baseUrl}`)
    console.log(`     Server: ${tool.serverName}`)
  })
  console.log()

  console.log('💬 Step 4: Enabled Prompts')
  const prompts = mcpCache.getEnabledPrompts()
  prompts.forEach(prompt => {
    console.log(`   - ${prompt.name}`)
    console.log(`     Description: ${prompt.description}`)
    console.log(`     Base URL: ${prompt.baseUrl}`)
    if (prompt.arguments && prompt.arguments.length > 0) {
      console.log(`     Arguments:`)
      prompt.arguments.forEach(arg => {
        console.log(`       - ${arg.name}${arg.required ? ' (required)' : ''}: ${arg.description}`)
      })
    }
  })
  console.log()

  console.log('🔍 Step 5: Find Specific Items')
  const marketAnalysis = mcpCache.findPrompt('market-analysis')
  if (marketAnalysis) {
    console.log(`   Found prompt: ${marketAnalysis.name}`)
    console.log(`   Base URL: ${marketAnalysis.baseUrl}`)
  }

  const analyzeCode = mcpCache.findTool('analyze_code')
  if (analyzeCode) {
    console.log(`   Found tool: ${analyzeCode.name}`)
    console.log(`   Description: ${analyzeCode.description}`)
  }
  console.log()

  console.log('🧹 Step 6: Update Cache')
  const updatedConfig = { ...ibkrConfig, name: 'IBKR MCP Server (Updated)' }
  mcpCache.updateCache('ibkr.mcp', updatedConfig)
  console.log('   Updated IBKR config name\n')

  console.log('📈 Step 7: Final Statistics')
  const finalStats = mcpCache.getStats()
  console.log(`   Total Configs: ${finalStats.totalConfigs}`)
  console.log(`   Total Tools: ${finalStats.totalTools}`)
  console.log(`   Total Prompts: ${finalStats.totalPrompts}\n`)

  console.log('✨ Verification Complete!')
}

// Run verification
runVerification().catch(console.error)
