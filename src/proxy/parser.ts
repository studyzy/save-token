import type { ProxyDiagnosisData, ProxyMessageBlock, ProxyToolDef } from '../types'

interface ChatMessage {
  role?: string
  content?: string | Array<{ type?: string; text?: string }>
  name?: string
}

interface ToolDefinition {
  type?: string
  function?: {
    name?: string
    description?: string
    parameters?: Record<string, unknown>
  }
  name?: string
  description?: string
}

interface ProxyRequestBody {
  messages?: ChatMessage[]
  tools?: ToolDefinition[]
  model?: string
  [key: string]: unknown
}

/**
 * Estimate tokens using the common approximation: 1 token ~= 4 characters.
 */
function estimateTokens(content: string): number {
  if (!content) return 0
  return Math.ceil(content.length / 4)
}

/**
 * Known builtin CodeBuddy tools. Anything not in this set is classified as MCP/deferred.
 */
const BUILTIN_TOOLS = new Set([
  'Agent',
  'Read',
  'Write',
  'Edit',
  'Bash',
  'Glob',
  'Grep',
  'EnterPlanMode',
  'ExitPlanMode',
  'TaskCreate',
  'TaskGet',
  'TaskUpdate',
  'TaskList',
  'WebFetch',
  'WebSearch',
  'TaskStop',
  'TaskOutput',
  'Skill',
  'AskUserQuestion',
  'ToolSearch',
  'DeferExecuteTool',
  'SendMessage',
  'WaitForMcpServers',
  'headroom_retrieve',
])

/**
 * Deferred tools loaded via ToolSearch/DeferExecuteTool pattern.
 */
const DEFERRED_TOOLS = new Set([
  'CronCreate',
  'CronDelete',
  'CronList',
  'EnterWorktree',
  'LeaveWorktree',
  'ImageEdit',
  'ImageGen',
  'VideoGen',
  'NotebookEdit',
  'LSP',
  'TeamCreate',
  'TeamDelete',
  'Workflow',
])

function classifyTool(name: string): ProxyToolDef['category'] {
  if (BUILTIN_TOOLS.has(name)) return 'builtin'
  if (DEFERRED_TOOLS.has(name)) return 'deferred'
  return 'mcp'
}

/**
 * Parse a captured CodeBuddy API request body into structured diagnosis data.
 */
export function parseProxyBody(body: unknown): ProxyDiagnosisData {
  const request = body as ProxyRequestBody

  const messages = request.messages ?? []
  const tools = request.tools ?? []
  const model = request.model ?? 'unknown'

  // --- Messages breakdown ---
  const roleCounts: Record<string, { count: number; estimatedTokens: number }> = {}
  const messageBreakdown: ProxyMessageBlock[] = []
  let systemPromptTokens = 0
  let memoryTokens = 0
  let rulesTokens = 0
  const skillReferences: string[] = []
  const mcpReferences: string[] = []

  for (const msg of messages) {
    const role = msg.role ?? 'unknown'

    if (typeof msg.content === 'string') {
      const tokens = estimateTokens(msg.content)
      roleCounts[role] = {
        count: (roleCounts[role]?.count ?? 0) + 1,
        estimatedTokens: (roleCounts[role]?.estimatedTokens ?? 0) + tokens,
      }
      messageBreakdown.push({
        role,
        index: messageBreakdown.length,
        contentType: 'string',
        estimatedTokens: tokens,
        charLength: msg.content.length,
        snippet: msg.content.slice(0, 80),
      })
      if (role === 'system') systemPromptTokens += tokens
      // Memory: system-reminder with data-role="memory"
      if (msg.content.includes('<system-reminder') && msg.content.includes('data-role="memory"')) {
        memoryTokens += tokens
      }
      // Search for available_skills in all messages
      extractSkillsFromText(msg.content, skillReferences)
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        const text = block.text ?? ''
        const tokens = estimateTokens(text)
        roleCounts[role] = {
          count: (roleCounts[role]?.count ?? 0) + 1,
          estimatedTokens: (roleCounts[role]?.estimatedTokens ?? 0) + tokens,
        }
        messageBreakdown.push({
          role,
          index: messageBreakdown.length,
          contentType: block.type ?? 'text',
          estimatedTokens: tokens,
          charLength: text.length,
          snippet: text.slice(0, 80),
        })

        if (role === 'system') systemPromptTokens += tokens

        // Memory: system-reminder with data-role="memory"
        if (text.includes('<system-reminder') && text.includes('data-role="memory"')) {
          memoryTokens += tokens
        }

        // Rules: codebuddyMd block with rules
        if (text.includes('<rules>') || text.includes('codebuddyMd')) {
          rulesTokens += tokens
        }

        // Skills: search ALL messages (not just system) for available_skills
        extractSkillsFromText(text, skillReferences)

        // MCP servers: search for MCP server references in system prompt
        extractMcpFromText(text, mcpReferences)
      }
    }
  }

  // --- Tool definitions ---
  const toolDefinitions: ProxyToolDef[] = tools.map((tool) => {
    const rawName = tool.function?.name ?? tool.name ?? 'unknown'
    const desc = tool.function?.description ?? tool.description ?? ''
    const toolJson = JSON.stringify(tool)
    return {
      name: rawName,
      category: classifyTool(rawName),
      estimatedTokens: estimateTokens(toolJson),
      description: desc.length > 100 ? desc.slice(0, 100) + '...' : desc,
    }
  })

  const builtinToolCount = toolDefinitions.filter((t) => t.category === 'builtin').length
  const mcpToolCount = toolDefinitions.filter((t) => t.category === 'mcp').length
  const toolDefinitionsTokens = toolDefinitions.reduce((s, t) => s + t.estimatedTokens, 0)

  // --- Total ---
  const totalEstimatedTokens =
    Object.values(roleCounts).reduce((sum, r) => sum + r.estimatedTokens, 0) + toolDefinitionsTokens

  return {
    messagesByRole: roleCounts,
    messageBreakdown,
    totalEstimatedTokens,
    toolDefinitions,
    toolDefinitionsTokens,
    builtinToolCount,
    mcpToolCount,
    systemPromptTokens,
    memoryTokens,
    rulesTokens,
    skillReferences,
    mcpReferences,
    model,
  }
}

function extractSkillsFromText(text: string, skillReferences: string[]): void {
  const skillMatches = text.matchAll(/<available_skills>([\s\S]*?)<\/available_skills>/g)
  for (const match of skillMatches) {
    const skillSection = match[1] ?? ''
    const names = skillSection.matchAll(/- name:\s*(\S+)/g)
    for (const nameMatch of names) {
      const name = nameMatch[1]
      if (name && !skillReferences.includes(name)) {
        skillReferences.push(name)
      }
    }
  }
}

function extractMcpFromText(text: string, mcpReferences: string[]): void {
  // Look for MCP tool definitions section in system prompt
  // Pattern: tools with `mcp__` prefix are MCP tools
  const mcpMatches = text.matchAll(/mcp__(\w+)/g)
  for (const match of mcpMatches) {
    const name = match[1]
    if (name && !mcpReferences.includes(name)) {
      mcpReferences.push(name)
    }
  }
}
