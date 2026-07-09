import type { ToolId } from '../../types'
import { BaseSaveTokenTool } from '../types'
import { registerTool } from '../registry'
import { commandExists, isProcessRunning } from '../../utils/platform'

class HeadroomTool extends BaseSaveTokenTool {
  readonly name: ToolId = 'headroom'
  readonly description = 'Headroom — 上下文压缩 47-92%'
  readonly savingEstimate = '47-92% 上下文压缩'
  readonly type = 'cli'
  readonly installCommand = 'pip install "headroom-ai[all]"'
  readonly verifyCommand = 'headroom --version'
  readonly configCommand = 'headroom mcp install'

  detect(): Promise<boolean> {
    return commandExists('headroom')
  }

  async isEnabled(): Promise<boolean> {
    const installed = await this.detect()
    if (!installed) return false
    const processRunning = await isProcessRunning('headroom')
    // MCP enabled 检测需要外部上下文（fs.mcpList / proxy mcpReferences），
    // 通过 setMcpEnabled 注入
    return processRunning && this._mcpEnabled
  }

  private _mcpEnabled = false

  setMcpEnabled(enabled: boolean): void {
    this._mcpEnabled = enabled
  }
}

export const headroomTool = new HeadroomTool()
registerTool(headroomTool)
