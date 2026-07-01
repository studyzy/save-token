import type { DiagnosisReport, OptimizationSuggestion, ToolId } from '../types'
import type { ToolInstallResult } from '../types'
import { TOOL_SAVINGS, TOOL_REASONS } from '../analyzers/rules'

export function generateSuggestions(report: DiagnosisReport): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = []
  const total = report.contextOverview.totalEstimatedTokens || 1

  for (const tool of report.toolDetection) {
    if (!tool.installed) {
      suggestions.push({
        id: `install-${tool.name}`,
        type: 'install_tool',
        target: tool.name,
        reason: TOOL_REASONS[tool.name],
        estimatedSavingTokens: TOOL_SAVINGS[tool.name],
        estimatedSavingPercent: (TOOL_SAVINGS[tool.name] / total) * 100,
        risk: 'low',
        reversible: true,
        actionType: getInstallAction(tool.name),
        actionPayload: {
          installCommand: getInstallCommand(tool.name),
          verifyCommand: getVerifyCommand(tool.name),
          configCommand: getConfigCommand(tool.name),
        },
      })
    }
  }

  for (const mcp of report.mcpList) {
    if (mcp.status !== 'enabled') continue
    if (mcp.hasCliAlternative) {
      suggestions.push({
        id: `disable-mcp-${mcp.name}`,
        type: 'config_change',
        target: mcp.name,
        reason: `MCP 有 CLI 等价物 ${mcp.cliAlternative}，CLI 不占用持久上下文`,
        estimatedSavingTokens: mcp.estimatedTokens,
        estimatedSavingPercent: (mcp.estimatedTokens / total) * 100,
        risk: 'low',
        reversible: true,
        actionType: 'disable_mcp',
        actionPayload: {
          targetFile: '~/.codebuddy/.mcp.json',
          operation: 'move-to-disabled',
        },
      })
    } else if (!mcp.deferLoading && (mcp.toolsCount ?? 0) > 3) {
      suggestions.push({
        id: `defer-mcp-${mcp.name}`,
        type: 'config_change',
        target: mcp.name,
        reason: `${mcp.name} 工具数 ${(mcp.toolsCount ?? '?')}，常驻占用，建议延迟加载`,
        estimatedSavingTokens: Math.floor(mcp.estimatedTokens * 0.7),
        estimatedSavingPercent: ((mcp.estimatedTokens * 0.7) / total) * 100,
        risk: 'low',
        reversible: true,
        actionType: 'enable_mcp_defer_loading',
        actionPayload: {
          targetFile: '~/.codebuddy/.mcp.json',
          operation: 'set-field',
          fieldName: 'defer_loading',
          fieldValue: true,
        },
      })
    }
  }

  if (report.mcpList.filter(m => m.status === 'enabled').length > 5) {
    suggestions.push({
      id: 'mcp-count-warning',
      type: 'habit_suggestion',
      target: 'MCP 总数',
      reason: '启用 MCP 超过 5 个，建议禁用低频或用 CLI 替代',
      estimatedSavingTokens: 0,
      estimatedSavingPercent: 0,
      risk: 'low',
      reversible: true,
      actionType: 'disable_mcp',
      actionPayload: {},
    })
  }

  for (const plugin of report.pluginList) {
    if (plugin.enabled && plugin.isLowFrequency) {
      suggestions.push({
        id: `disable-plugin-${plugin.id}`,
        type: 'config_change',
        target: plugin.id,
        reason: `低频插件 ${plugin.id}，编码场景建议禁用`,
        estimatedSavingTokens: 500,
        estimatedSavingPercent: (500 / total) * 100,
        risk: 'low',
        reversible: true,
        actionType: 'disable_plugin',
        actionPayload: {
          targetFile: '~/.codebuddy/settings.json',
          operation: 'set-field',
          fieldName: `enabledPlugins.${plugin.id}`,
          fieldValue: false,
        },
      })
    }
  }

  if (report.skillList.length > 10) {
    suggestions.push({
      id: 'skill-count-warning',
      type: 'config_change',
      target: 'Skills 总数',
      reason: `已加载 ${report.skillList.length} 个 Skill，建议禁用低频 skill`,
      estimatedSavingTokens: Math.floor(
        report.skillList.slice(10).reduce((s, x) => s + x.estimatedTokens, 0) * 0.5,
      ),
      estimatedSavingPercent:
        ((report.skillList.slice(10).reduce((s, x) => s + x.estimatedTokens, 0) * 0.5) / total) *
        100,
      risk: 'medium',
      reversible: true,
      actionType: 'disable_skill',
      actionPayload: {},
    })
  }

  const codebuddyMd = report.configFiles.find(c => c.path.endsWith('CODEBUDDY.md'))
  if (codebuddyMd && codebuddyMd.exists && codebuddyMd.lineCount > 200) {
    suggestions.push({
      id: 'simplify-codebuddy-md',
      type: 'habit_suggestion',
      target: 'CODEBUDDY.md',
      reason: `CODEBUDDY.md ${codebuddyMd.lineCount} 行，建议精简`,
      estimatedSavingTokens: Math.floor(codebuddyMd.estimatedTokens * 0.4),
      estimatedSavingPercent: ((codebuddyMd.estimatedTokens * 0.4) / total) * 100,
      risk: 'medium',
      reversible: true,
      actionType: 'simplify_codebuddy_md',
      actionPayload: {},
    })
  }

  if (report.configFiles.find(c => c.path.endsWith('history.jsonl'))?.sizeBytes ?? 0 > 50 * 1024 * 1024) {
    suggestions.push({
      id: 'cleanup-history',
      type: 'habit_suggestion',
      target: 'history.jsonl',
      reason: 'history.jsonl 超过 50MB，建议清理',
      estimatedSavingTokens: 0,
      estimatedSavingPercent: 0,
      risk: 'low',
      reversible: false,
      actionType: 'cleanup_history',
      actionPayload: {},
    })
  }

  return suggestions.sort((a, b) => b.estimatedSavingTokens - a.estimatedSavingTokens)
}

function getInstallAction(tool: ToolId): OptimizationSuggestion['actionType'] {
  return `install_${tool}` as OptimizationSuggestion['actionType']
}

function getInstallCommand(tool: ToolId): string {
  switch (tool) {
    case 'rtk':
      return 'brew install rtk && rtk init -g --agent codebuddy'
    case 'caveman':
      return 'git clone https://github.com/studyzy/caveman /tmp/caveman && cd /tmp/caveman && ./install.sh'
    case 'headroom':
      return 'pip install "headroom-ai[all]" && headroom mcp install'
    case 'lean-ctx':
      return 'brew install lean-ctx && lean-ctx setup'
    case 'graphify':
      return 'uv tool install graphifyy && graphify install --platform codebuddy'
  }
}

function getVerifyCommand(tool: ToolId): string {
  switch (tool) {
    case 'rtk':
      return 'rtk gain'
    case 'caveman':
      return 'ls ~/.codebuddy/plugins/marketplaces/caveman/'
    case 'headroom':
      return 'headroom --version'
    case 'lean-ctx':
      return 'lean-ctx doctor'
    case 'graphify':
      return 'graphify --version'
  }
}

function getConfigCommand(tool: ToolId): string {
  switch (tool) {
    case 'rtk':
      return 'rtk init -g --agent codebuddy'
    case 'caveman':
      return ''
    case 'headroom':
      return 'headroom mcp install'
    case 'lean-ctx':
      return 'lean-ctx setup'
    case 'graphify':
      return 'graphify install --platform codebuddy'
  }
}

export type { ToolInstallResult }
