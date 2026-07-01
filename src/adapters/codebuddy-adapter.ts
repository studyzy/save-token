import type { PlatformAdapter, PlatformConfigPaths } from './platform-adapter'
import { commandExists, getHomeDir } from '../utils/platform'

export class CodeBuddyAdapter implements PlatformAdapter {
  readonly name = 'codebuddy'

  async detectInstall(): Promise<boolean> {
    return commandExists('codebuddy')
  }

  getConfigPaths(): PlatformConfigPaths {
    const dir = `${getHomeDir()}/.codebuddy`
    return {
      mcp: `${dir}/.mcp.json`,
      settings: `${dir}/settings.json`,
      codebuddyMd: `${dir}/CODEBUDDY.md`,
      skillsDir: `${dir}/skills`,
      commandsDir: `${dir}/commands`,
      rulesDir: `${dir}/rules`,
      agentsDir: `${dir}/agents`,
      pluginsMarketplacesDir: `${dir}/plugins/marketplaces`,
      historyFile: `${dir}/history.jsonl`,
      blobsDir: `${dir}/blobs`,
      cliBinary: 'codebuddy',
    }
  }

  getHeadlessCommand(prompt: string, schema?: object): string[] {
    const args = ['-p', prompt, '--output-format', 'json', '-y', '--max-turns', '2']
    if (schema) {
      args.push('--json-schema', JSON.stringify(schema))
    }
    return args
  }

  parseHeadlessOutput(raw: string): unknown {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
}
