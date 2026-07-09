import type { ToolId } from '../../types'
import { BaseSaveTokenTool } from '../types'
import { registerTool } from '../registry'
import { exists } from '../../utils/fs-operations'
import { commandExists } from '../../utils/platform'
import path from 'path'

class GraphifyTool extends BaseSaveTokenTool {
  readonly name: ToolId = 'graphify'
  readonly description = 'Graphify — 代码图谱减少盲搜'
  readonly savingEstimate = '71.5x 代码图谱'
  readonly type = 'cli'
  readonly installCommand = 'uv tool install graphifyy'
  readonly verifyCommand = 'graphify --version'
  readonly configCommand = 'graphify install --platform codebuddy'

  detect(): Promise<boolean> {
    return commandExists('graphify')
  }

  isEnabled(): Promise<boolean> {
    // graphify 启用检测：当前工作目录下存在 graphify-out 目录
    return Promise.resolve(exists(path.join(process.cwd(), 'graphify-out')))
  }
}

export const graphifyTool = new GraphifyTool()
registerTool(graphifyTool)
