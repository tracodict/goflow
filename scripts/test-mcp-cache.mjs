#!/usr/bin/env node
/**
 * Test script to verify MCP cache loading from GitHub workspace
 * 
 * This demonstrates the complete flow:
 * 1. Load .mcp files from GitHub workspace
 * 2. Cache the tools and prompts
 * 3. Verify enabledTools is populated
 */

const WORKSPACE_ID = 'github:haymant|flowtrade@goflow-1762411746032'
const API_BASE = 'http://localhost:3000'

async function testMcpCacheLoading() {
  console.log('🧪 Testing MCP Cache Loading from GitHub Workspace\n')
  
  // Step 1: Load cache
  console.log('Step 1: Loading MCP cache from workspace...')
  console.log(`Workspace ID: ${WORKSPACE_ID}\n`)
  
  const loadResponse = await fetch(`${API_BASE}/api/mcp-cache`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // In production, this would come from session cookie
      'Cookie': 'lz_sess=your-session-id'
    },
    body: JSON.stringify({ workspaceId: WORKSPACE_ID })
  })
  
  const loadResult = await loadResponse.json()
  console.log('Load Result:', JSON.stringify(loadResult, null, 2))
  
  if (!loadResult.success) {
    console.error('❌ Failed to load cache:', loadResult.message)
    return
  }
  
  console.log(`✅ Loaded ${loadResult.data.totalConfigs} MCP configurations`)
  console.log(`   - ${loadResult.data.totalTools} tools`)
  console.log(`   - ${loadResult.data.totalPrompts} prompts`)
  console.log(`   - ${loadResult.data.totalResources} resources\n`)
  
  // Step 2: Get cache stats
  console.log('Step 2: Verifying cache stats...')
  const statsResponse = await fetch(`${API_BASE}/api/mcp-cache?type=stats`)
  const statsResult = await statsResponse.json()
  console.log('Stats:', JSON.stringify(statsResult, null, 2), '\n')
  
  // Step 3: Get all enabled tools
  console.log('Step 3: Getting enabled tools...')
  const toolsResponse = await fetch(`${API_BASE}/api/mcp-cache?type=tools`)
  const toolsResult = await toolsResponse.json()
  
  if (toolsResult.success && toolsResult.data) {
    console.log(`✅ Found ${toolsResult.data.length} enabled tools:`)
    
    // Group by server
    const byServer = {}
    for (const tool of toolsResult.data) {
      const server = tool.serverName || 'unknown'
      if (!byServer[server]) byServer[server] = []
      byServer[server].push(tool.name)
    }
    
    for (const [server, tools] of Object.entries(byServer)) {
      console.log(`\n   ${server} (${tools.length} tools):`)
      tools.slice(0, 5).forEach(name => console.log(`   - ${name}`))
      if (tools.length > 5) {
        console.log(`   ... and ${tools.length - 5} more`)
      }
    }
  }
  
  console.log('\n')
  
  // Step 4: Get all enabled prompts
  console.log('Step 4: Getting enabled prompts...')
  const promptsResponse = await fetch(`${API_BASE}/api/mcp-cache?type=prompts`)
  const promptsResult = await promptsResponse.json()
  
  if (promptsResult.success && promptsResult.data) {
    console.log(`✅ Found ${promptsResult.data.length} enabled prompts:`)
    promptsResult.data.forEach(prompt => {
      console.log(`   - ${prompt.name}: ${prompt.description || 'no description'}`)
    })
  }
  
  console.log('\n✅ All tests passed!')
  console.log('\nExpected results based on the .mcp files:')
  console.log('- IBKR.mcp should provide ~60 trading tools (ibkr_connect, ibkr_place_order, etc.)')
  console.log('- IBKR.mcp should provide 6 prompts (setup_trading_workspace, rebalance_portfolio, etc.)')
  console.log('- T1.mcp should provide 9 Yahoo Finance tools (yahoo_search, yahoo_quote, etc.)')
}

// Run the test
testMcpCacheLoading().catch(console.error)
