import type { UsageScenario } from '../types'

/**
 * Ask user their CodeBuddy usage scenario via interactive prompt.
 * Returns 'general' when not running in a TTY (non-interactive mode).
 */
export async function askScenario(): Promise<UsageScenario> {
  if (!process.stdout.isTTY) {
    return 'general'
  }

  try {
    // Dynamic import — inquirer v12 is ESM-only
    const { default: inquirer } = await import('inquirer')
    const answer = await inquirer.prompt<{ scenario: string }>([
      {
        type: 'list',
        name: 'scenario',
        message: '你的 CodeBuddy 主要用于什么场景？',
        choices: [
          { name: '代码开发', value: 'coding' },
          { name: '文档写作', value: 'docs' },
          { name: '通用', value: 'general' },
        ],
        default: 'general',
      },
    ])
    return answer.scenario as UsageScenario
  } catch {
    return 'general'
  }
}
