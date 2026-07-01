/**
 * Estimate token count from content length.
 * Uses the common approximation: 1 token ~= 4 characters.
 */
export function estimate(content: string): number {
  if (!content) return 0
  return Math.ceil(content.length / 4)
}

/**
 * Estimate token count for a file. Returns 0 if file does not exist or cannot be read.
 */
export function estimateFile(content: string | null): number {
  if (content === null) return 0
  return estimate(content)
}

/**
 * Rough per-tool token estimate for MCP tool definitions.
 * Each MCP tool definition averages ~200 tokens based on field schemas + descriptions.
 */
export const TOKENS_PER_MCP_TOOL = 200

/**
 * Estimate MCP server token contribution based on toolsCount.
 * Falls back to config size estimate when toolsCount is unknown.
 */
export function estimateMcpTokens(
  toolsCount: number | null,
  configSizeBytes: number,
): number {
  if (toolsCount !== null && toolsCount > 0) {
    return toolsCount * TOKENS_PER_MCP_TOOL
  }
  return Math.ceil(configSizeBytes / 4)
}

/**
 * Classify impact level by file size.
 */
export function impactLevel(sizeBytes: number): 'low' | 'medium' | 'high' {
  if (sizeBytes >= 5120) return 'high'
  if (sizeBytes >= 1024) return 'medium'
  return 'low'
}
