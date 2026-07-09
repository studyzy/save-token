/**
 * Rule data and mappings for suggestion generation.
 * Tool install commands are sourced from blog.md chapter 4.
 */
import type { ToolId, UsageScenario } from '../types'

export interface ToolInstallSpec {
  id: ToolId
  installCommand: string
  verifyCommand: string
  configCommand: string
  recommendedSaving: string
}

export const TOOL_SAVINGS: Record<ToolId, number> = {
  rtk: 8900,
  caveman: 3500,
  headroom: 6200,
  'lean-ctx': 4200,
  graphify: 5400,
  ponytail: 8000,
}

export const TOOL_REASONS: Record<ToolId, string> = {
  rtk: '终端命令输出压缩 ~89%，测试/git/搜索高频场景',
  caveman: 'AI 回复压缩 65-75%，减少输出端废 Token',
  headroom: '所有进上下文内容压缩 47-92%',
  'lean-ctx': '读取时筛选 + 跨会话记忆 60-90%',
  graphify: '代码图谱减少盲搜，比读文件少 71.5x Token',
  ponytail: '决策阶梯减少过度工程，代码少 54% + 成本降 20-75%',
}

export const TOOL_SPECS: Record<ToolId, ToolInstallSpec> = {
  rtk: {
    id: 'rtk',
    installCommand: 'brew install rtk',
    verifyCommand: 'rtk gain',
    configCommand: 'rtk init -g --agent codebuddy',
    recommendedSaving: '~89% 命令输出压缩',
  },
  caveman: {
    id: 'caveman',
    installCommand:
      'git clone https://github.com/studyzy/caveman /tmp/caveman && cd /tmp/caveman && ./install.sh',
    verifyCommand: 'ls ~/.codebuddy/plugins/marketplaces/caveman/',
    configCommand: '',
    recommendedSaving: '65-75% AI 回复压缩',
  },
  headroom: {
    id: 'headroom',
    installCommand: 'pip install "headroom-ai[all]"',
    verifyCommand: 'headroom --version',
    configCommand: 'headroom mcp install',
    recommendedSaving: '47-92% 上下文压缩',
  },
  'lean-ctx': {
    id: 'lean-ctx',
    installCommand: 'brew install lean-ctx',
    verifyCommand: 'lean-ctx doctor',
    configCommand: 'lean-ctx setup',
    recommendedSaving: '60-90% 读取筛选',
  },
  graphify: {
    id: 'graphify',
    installCommand: 'uv tool install graphifyy',
    verifyCommand: 'graphify --version',
    configCommand: 'graphify install --platform codebuddy',
    recommendedSaving: '71.5x 代码图谱',
  },
  ponytail: {
    id: 'ponytail',
    installCommand: 'codebuddy plugin marketplace add https://github.com/studyzy/ponytail',
    verifyCommand: 'ls ~/.codebuddy/plugins/marketplaces/ponytail/',
    configCommand: '',
    recommendedSaving: '54% 代码量 + 20-75% 成本',
  },
}

export const THRESHOLDS = {
  MCP_COUNT_WARN: 5,
  SKILL_COUNT_WARN: 10,
  CODEBUDDY_MD_LINES_WARN: 200,
  HISTORY_BYTES_WARN: 50 * 1024 * 1024,
  MCP_DEFER_TOOLS_THRESHOLD: 3,
} as const

/** Tools recommended per scenario. RTK/Headroom/Lean-ctx are universal. */
export const SCENARIO_TOOL_MAP: Record<UsageScenario, ToolId[]> = {
  coding: ['rtk', 'caveman', 'headroom', 'lean-ctx', 'ponytail'],
  docs: ['rtk', 'headroom', 'lean-ctx'],
  general: ['rtk', 'caveman', 'headroom', 'lean-ctx', 'ponytail'],
}

/** Code knowledge-base MCP recommendations (large codebase projects). */
export const CODE_KNOWLEDGE_MCPS = [
  {
    name: 'Codebase-memory-mcp',
    description: '代码库知识图谱 MCP，提供结构化代码查询',
    installCommand: 'npx @anthropic-ai/codebase-memory-mcp',
  },
  {
    name: 'GitNexus',
    description: 'Git 仓库代码知识管理工具',
    installCommand: 'brew install gitnexus && gitnexus init',
  },
  {
    name: 'CodeGraph',
    description: '代码图谱生成和查询工具',
    installCommand: 'npm install -g codegraph && codegraph init',
  },
]
