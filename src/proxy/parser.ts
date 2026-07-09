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
])

/**
 * MCP tools that appear directly in the top-level tools[] array (non-deferred).
 * These carry an `mcp__` prefix or belong to known MCP servers.
 */
const MCP_PREFIXES = ['mcp__', 'headroom_']

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
  if (MCP_PREFIXES.some((p) => name.startsWith(p))) return 'mcp'
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

  // --- MCP tools from ToolSearch description ---
  const deferredMcp = extractDeferredMcpTools(tools)
  toolDefinitions.push(...deferredMcp.tools)
  // Merge server-level MCP references from deferred tools block
  for (const ref of deferredMcp.references) {
    if (!mcpReferences.includes(ref)) {
      mcpReferences.push(ref)
    }
  }

  // --- Plugin detection via proxy body markers ---
  const detectedPlugins = detectPluginsFromMessages(messages)

  // --- Skill tokens from Skill tool definition ---
  const skillTokens = extractSkillTokens(tools)

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
    skillTokens,
    mcpReferences,
    detectedPlugins,
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

/**
 * Parse individual skill entries from the Skill tool definition.
 * Each skill entry in the <available_skills> block has format:
 *   name: description... (location: /path/to/SKILL.md)
 * Returns a map from skill name to its description text and estimated token count.
 * Builtin commands (clear, config, etc.) with empty location are skipped.
 */
function extractSkillTokens(
  tools: ToolDefinition[],
): Record<string, { description: string; estimatedTokens: number }> {
  const skillTool = tools.find((t) => (t.function?.name ?? t.name) === 'Skill')
  if (!skillTool) return {}

  const desc = skillTool.function?.description ?? skillTool.description ?? ''
  const match = desc.match(/<available_skills>\n([\s\S]*?)\n<\/available_skills>/)
  if (!match) return {}

  const block = match[1] ?? ''
  const entries = block.split('\n- ')
  const result: Record<string, { description: string; estimatedTokens: number }> = {}

  for (const entry of entries) {
    const trimmed = entry.trim()
    if (!trimmed) continue

    // Only count real skills (those with a non-empty file location)
    const locMatch = trimmed.match(/\(location:\s*(.+?)\)/)
    if (!locMatch?.[1]) continue

    const nameMatch = trimmed.match(/^([^:]+):/)
    if (!nameMatch?.[1]) continue

    const name = nameMatch[1]
    result[name] = {
      description: trimmed,
      estimatedTokens: Math.ceil(trimmed.length / 4),
    }
  }

  return result
}

/**
 * Detect plugins active in the request body via mode markers in message content.
 * Scans all messages for known activation patterns (e.g. "PONYTAIL MODE ACTIVE").
 */
function detectPluginsFromMessages(messages: ChatMessage[]): string[] {
  const markers: Record<string, string> = {
    caveman: 'CAVEMAN MODE ACTIVE',
    ponytail: 'PONYTAIL MODE ACTIVE',
  }
  const detected: string[] = []

  for (const msg of messages) {
    const content = typeof msg.content === 'string' ? msg.content : ''
    for (const [plugin, marker] of Object.entries(markers)) {
      if (!detected.includes(plugin) && content.includes(marker)) {
        detected.push(plugin)
      }
    }
  }

  return detected
}

/**
 * Extract MCP tools from ToolSearch.description's <available_deferred_tools> block.
 *
 * Two cases:
 * 1. Bare `mcp__XXX` (no colon, no description) → server-level reference, returned in `references`.
 * 2. `mcp__XXX: description...` → full tool definition with schema in top-level tools[], returned in `tools`.
 */
function extractDeferredMcpTools(tools: ToolDefinition[]): {
  tools: ProxyToolDef[]
  references: string[]
} {
  const toolSearchDef = tools.find((t) => (t.function?.name ?? t.name) === 'ToolSearch')
  if (!toolSearchDef) return { tools: [], references: [] }

  const desc = toolSearchDef.function?.description ?? toolSearchDef.description ?? ''
  const match = desc.match(/<available_deferred_tools>([\s\S]*?)<\/available_deferred_tools>/)
  if (!match) return { tools: [], references: [] }

  const block = match[1] ?? ''
  const lines = block.split('\n')
  const result: ProxyToolDef[] = []
  const refs: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.startsWith('mcp__')) {
      // Bare `mcp__XXX` → server-level reference, not a concrete tool
      if (!trimmed.includes(':')) {
        refs.push(trimmed)
        continue
      }
      // `mcp__XXX: description...` → full tool definition
      result.push({
        name: trimmed.split(':')[0],
        category: 'mcp',
        estimatedTokens: estimateTokens(trimmed),
        description: trimmed,
      })
      continue
    }

    // Non-MCP deferred tools have `Name: description` format
    const nameMatch = trimmed.match(/^(\S+):/)
    if (!nameMatch?.[1]) continue

    const name = nameMatch[1]
    if (!name.startsWith('mcp__')) continue

    result.push({
      name,
      category: 'mcp',
      estimatedTokens: estimateTokens(trimmed),
      description: trimmed,
    })
  }

  return { tools: result, references: refs }
}
