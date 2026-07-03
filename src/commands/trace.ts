import type { TraceOptions } from '../types'
import { startProxy, stopProxy } from '../proxy/server'
import { ensureResourceDir } from '../utils/resource-dir'
import { handleGeneralError } from '../utils/error-handler'

/**
 * Start a tracing HTTP proxy that records all CodeBuddy API requests/responses
 * to <resourceDir>/trace/<sessionId>/<timestamp>-{request,response}.json.
 */
export async function trace(options: TraceOptions): Promise<void> {
  try {
    const resourceDir = ensureResourceDir()
    const traceDir = options.traceDir ?? `${resourceDir}/trace`

    const proxy = await startProxy({
      port: options.port,
      apiBaseUrl: options.upstream,
      traceDir,
    })

    console.log('')
    console.log(`Proxy 监听: http://127.0.0.1:${proxy.port}`)
    console.log(`Trace 目录: ${traceDir}`)
    console.log('')
    console.log('请在新终端执行以下命令启动 CodeBuddy：')
    console.log('')
    console.log(`  export CODEBUDDY_BASE_URL=http://127.0.0.1:${proxy.port}/v2`)
    console.log(`  codebuddy`)
    console.log('')
    console.log('按 Ctrl+C 停止 Proxy')

    await new Promise<void>((resolve) => {
      const onSigint = (): void => {
        process.off('SIGINT', onSigint)
        resolve()
      }
      process.on('SIGINT', onSigint)
    })

    console.log('')
    console.log('正在关闭 Proxy...')
    await stopProxy(proxy)
    console.log('已停止')
  } catch (error) {
    handleGeneralError(error)
  }
}
