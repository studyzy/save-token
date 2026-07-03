import type { ProxyCollectResult } from '../types'
import type { PlatformAdapter } from '../adapters/platform-adapter'
import { startProxy, stopProxy, findMainChatBody } from '../proxy/server'
import { parseProxyBody } from '../proxy/parser'
import { exec } from 'tinyexec'

const PROXY_TIMEOUT_MS = 60_000

/**
 * Run diagnosis via proxy interception.
 *
 * 1. Start a local HTTP proxy on a random port
 * 2. Set CODEBUDDY_BASE_URL to point to the proxy
 * 3. Run `codebuddy -p "Hello" -y --max-turns 1` through the proxy
 * 4. Capture ALL POST bodies sent to the LLM API
 * 5. Identify the main chat request (has tools + messages)
 * 6. Stop the proxy and restore the original env
 * 7. Parse the captured body into structured data
 */
export async function runProxyDiagnose(adapter: PlatformAdapter): Promise<ProxyCollectResult> {
  const cliBinary = adapter.getConfigPaths().cliBinary

  try {
    const proxy = await startProxy()
    const originalBaseUrl = process.env.CODEBUDDY_BASE_URL
    process.env.CODEBUDDY_BASE_URL = `http://127.0.0.1:${proxy.port}/v2`

    try {
      await exec(cliBinary, ['-p', 'Hello', '-y', '--max-turns', '1'], {
        timeout: PROXY_TIMEOUT_MS,
      })
    } finally {
      // Restore original env
      if (originalBaseUrl !== undefined) {
        process.env.CODEBUDDY_BASE_URL = originalBaseUrl
      } else {
        delete process.env.CODEBUDDY_BASE_URL
      }
    }

    await stopProxy(proxy)

    const capturedBodies = proxy.capturedBodies
    if (capturedBodies.length === 0) {
      return {
        ok: false,
        error: 'No request bodies captured from proxy',
        rawBody: null,
        parsed: null,
      }
    }

    // Find the main chat request (not memory selection or other auxiliary requests)
    const mainBody = findMainChatBody(capturedBodies)
    if (!mainBody) {
      return {
        ok: false,
        error: `Captured ${capturedBodies.length} request(s) but none matched main chat pattern`,
        rawBody: capturedBodies,
        parsed: null,
      }
    }

    const parsed = parseProxyBody(mainBody)

    return {
      ok: true,
      rawBody: mainBody,
      parsed,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      rawBody: null,
      parsed: null,
    }
  }
}
