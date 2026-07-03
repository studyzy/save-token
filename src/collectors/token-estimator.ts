/**
 * Token estimation with CJK-aware calibration.
 *
 * Calibration:
 *   - Non-CJK (Latin/code/punctuation): ~3.3 chars/token (vs naive 4.0, avoids ~17% underestimate)
 *   - CJK (ideographs/kana/hangul/fullwidth):   ~1.0 token/char  (vs naive 4.0, avoids ~3x underestimate)
 *   - Pure ASCII fast-path: skip per-character scan for the common code case.
 *
 * Based on measurement against cl100k / Claude BPE families (±10% for ASCII code).
 */

const CODE_CHARS_PER_TOKEN = 3.3

/**
 * Conservative high-density Unicode ranges for CJK/ideographic characters.
 * Characters outside these ranges fall back to the Latin ratio (safe, slightly high side).
 */
function isCJK(ch: string): boolean {
  const o = ch.codePointAt(0)!
  return (
    (o >= 0x3040 && o <= 0x30ff) || // Hiragana + Katakana
    (o >= 0x3400 && o <= 0x4dbf) || // CJK Extension A
    (o >= 0x4e00 && o <= 0x9fff) || // CJK Unified Ideographs
    (o >= 0xac00 && o <= 0xd7a3) || // Hangul Syllables
    (o >= 0xf900 && o <= 0xfaff) || // CJK Compatibility Ideographs
    (o >= 0xff00 && o <= 0xffef) || // Halfwidth and Fullwidth Forms
    (o >= 0x20000 && o <= 0x2fa1f) // CJK Extensions B-F + Supplement
  )
}

/**
 * Estimate token count from text content.
 * Returns 0 for empty string; always returns at least 1 for non-empty input.
 */
export function estimate(content: string): number {
  if (!content) return 0

  // Pure ASCII fast-path — skip per-character scan for the vast majority of source code.
  if (!/[\u0080-\uFFFF]/.test(content)) {
    return Math.max(1, Math.ceil(content.length / CODE_CHARS_PER_TOKEN))
  }

  let cjk = 0
  for (const ch of content) {
    if (isCJK(ch)) cjk++
  }
  const other = content.length - cjk
  return Math.max(1, Math.ceil(other / CODE_CHARS_PER_TOKEN) + cjk)
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
export function estimateMcpTokens(toolsCount: number | null, configSizeBytes: number): number {
  if (toolsCount !== null && toolsCount > 0) {
    return toolsCount * TOKENS_PER_MCP_TOOL
  }
  return Math.ceil(configSizeBytes / CODE_CHARS_PER_TOKEN)
}

/**
 * Classify impact level by file size.
 */
export function impactLevel(sizeBytes: number): 'low' | 'medium' | 'high' {
  if (sizeBytes >= 5120) return 'high'
  if (sizeBytes >= 1024) return 'medium'
  return 'low'
}
