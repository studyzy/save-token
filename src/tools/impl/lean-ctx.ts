import type { ToolId } from '../../types'
import { BaseSaveTokenTool } from '../types'
import { registerTool } from '../registry'
import { commandExists } from '../../utils/platform'

class LeanCtxTool extends BaseSaveTokenTool {
  readonly name: ToolId = 'lean-ctx'
  readonly description = 'lean-ctx — 读取筛选 + 跨会话记忆 60-90%'
  readonly savingEstimate = '60-90% 读取筛选'
  readonly type = 'cli'
  readonly installCommand = 'brew install lean-ctx'
  readonly verifyCommand = 'lean-ctx doctor'
  readonly configCommand = 'lean-ctx setup'

  detect(): Promise<boolean> {
    return commandExists('lean-ctx')
  }

  isEnabled(): Promise<boolean> {
    // lean-ctx 当前没有可靠的启用检测方式
    return Promise.resolve(false)
  }
}

export const leanCtxTool = new LeanCtxTool()
registerTool(leanCtxTool)
