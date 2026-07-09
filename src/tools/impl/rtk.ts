import type { ToolId } from '../../types'
import { BaseSaveTokenTool } from '../types'
import { registerTool } from '../registry'
import { commandExists } from '../../utils/platform'

class RtkTool extends BaseSaveTokenTool {
  readonly name: ToolId = 'rtk'
  readonly description = 'RTK — 终端命令输出压缩 ~89%'
  readonly savingEstimate = '~89% 命令输出压缩'
  readonly type = 'cli'
  readonly installCommand = 'brew install rtk'
  readonly verifyCommand = 'rtk gain'
  readonly configCommand = 'rtk init -g --agent codebuddy'

  detect(): Promise<boolean> {
    return commandExists('rtk')
  }

  isEnabled(): Promise<boolean> {
    // RTK 通过 CodeBuddy PreToolUse hook 启用
    // 此方法在 BaseSaveTokenTool.buildDetection 中被调用，
    // 但 RTK 的 enabled 检测需要 fs.hookList 上下文。
    // 默认返回 false，调用方可通过 setHookEnabled 覆盖。
    return Promise.resolve(this._hookEnabled)
  }

  private _hookEnabled = false

  setHookEnabled(enabled: boolean): void {
    this._hookEnabled = enabled
  }
}

export const rtkTool = new RtkTool()
registerTool(rtkTool)
