import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest'
import { startProxy, stopProxy, findMainChatBody } from '../../src/proxy/server'
import * as http from 'node:http'
import * as os from 'node:os'
import * as path from 'node:path'
import * as fs from 'node:fs'

function mkdtempTrace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'st-trace-'))
}

function listTraceFiles(dir: string): string[] {
  return fs.readdirSync(dir).sort()
}

describe('proxy server', () => {
  afterEach(() => {
    // Cleanup in case a test fails without stopping
  })

  it('should start on random port and be stoppable', async () => {
    const proxy = await startProxy({ port: 0 })

    expect(proxy.port).toBeGreaterThan(0)
    expect(proxy.captured).toBe(false)
    expect(proxy.capturedBodies).toEqual([])

    await stopProxy(proxy)
  })

  it('should capture POST body on /v2/* path', async () => {
    const proxy = await startProxy({ port: 0 })

    const testBody = JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] })
    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: proxy.port,
          path: '/v2/messages',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(testBody).toString(),
          },
        },
        (res) => {
          res.resume()
          res.on('end', resolve)
        },
      )
      req.on('error', reject)
      req.write(testBody)
      req.end()
    })

    expect(proxy.captured).toBe(true)
    expect(proxy.capturedBodies.length).toBe(1)
    expect(proxy.capturedBodies[0]).toEqual({ messages: [{ role: 'user', content: 'hello' }] })

    await stopProxy(proxy)
  })

  it('should not capture non-POST requests', async () => {
    const proxy = await startProxy({ port: 0 })

    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: proxy.port,
          path: '/v2/health',
          method: 'GET',
        },
        (res) => {
          res.resume()
          res.on('end', resolve)
        },
      )
      req.on('error', reject)
      req.end()
    })

    expect(proxy.captured).toBe(false)

    await stopProxy(proxy)
  })

  it('should not capture non-/v2/ POST paths', async () => {
    const proxy = await startProxy({ port: 0 })

    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: proxy.port,
          path: '/health',
          method: 'POST',
          headers: { 'Content-Length': '5' },
        },
        (res) => {
          res.resume()
          res.on('end', resolve)
        },
      )
      req.on('error', reject)
      req.write('hello')
      req.end()
    })

    expect(proxy.captured).toBe(false)

    await stopProxy(proxy)
  })

  it('should capture multiple POST requests', async () => {
    const proxy = await startProxy({ port: 0 })

    const sendReq = (path: string, body: unknown) =>
      new Promise<void>((resolve, reject) => {
        const bodyStr = JSON.stringify(body)
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: proxy.port,
            path,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(bodyStr).toString(),
            },
          },
          (res) => {
            res.resume()
            res.on('end', resolve)
          },
        )
        req.on('error', reject)
        req.write(bodyStr)
        req.end()
      })

    await sendReq('/v2/memory', { messages: [{ role: 'system' }] })
    await sendReq('/v2/chat/completions', {
      messages: [{ role: 'user', content: 'Hello' }],
      tools: [{ name: 'read' }],
    })

    expect(proxy.capturedBodies.length).toBe(2)

    await stopProxy(proxy)
  })
})

describe('findMainChatBody', () => {
  it('should find body with tools and user message', () => {
    const bodies = [
      {
        messages: [
          { role: 'system', content: 'select memory' },
          { role: 'user', content: 'query' },
        ],
      },
      {
        messages: [
          { role: 'system', content: 'you are an assistant' },
          { role: 'user', content: 'Hello' },
        ],
        tools: [{ name: 'read' }, { name: 'write' }],
      },
    ]

    const result = findMainChatBody(bodies)
    expect(result).toEqual(bodies[1])
  })

  it('should fallback to body with most messages', () => {
    const bodies = [
      { messages: [{ role: 'user' }] },
      { messages: [{ role: 'system' }, { role: 'user' }, { role: 'assistant' }] },
    ]

    const result = findMainChatBody(bodies)
    expect(result).toEqual(bodies[1])
  })

  it('should return null for empty array', () => {
    expect(findMainChatBody([])).toBeNull()
  })

  it('should return null for bodies without messages array', () => {
    expect(findMainChatBody([{ stream: true }])).toBeNull()
  })
})

describe('proxy trace mode', () => {
  let upstream: http.Server
  let upstreamPort: number

  beforeAll(async () => {
    const up = await new Promise<{ server: http.Server; port: number }>((resolve) => {
      const s = http.createServer((req, res) => {
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ ok: true, echo: Buffer.concat(chunks).toString('utf-8') }))
        })
      })
      s.listen(0, '127.0.0.1', () => {
        const addr = s.address()
        if (addr && typeof addr === 'object') resolve({ server: s, port: addr.port })
      })
    })
    upstream = up.server
    upstreamPort = up.port
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => upstream.close(() => resolve()))
  })

  it('should write trace files when traceDir is set', async () => {
    const traceDir = mkdtempTrace()
    const proxy = await startProxy({
      port: 0,
      apiBaseUrl: `http://127.0.0.1:${upstreamPort}`,
      traceDir,
    })

    const sessionId = 'test-session-123'
    const testBody = JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] })
    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: proxy.port,
          path: '/v2/messages',
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-conversation-id': sessionId,
            'content-length': Buffer.byteLength(testBody).toString(),
          },
        },
        (res) => {
          res.resume()
          res.on('end', resolve)
        },
      )
      req.on('error', reject)
      req.write(testBody)
      req.end()
    })

    await stopProxy(proxy)

    const sessionDir = path.join(traceDir, sessionId)
    expect(fs.existsSync(sessionDir)).toBe(true)
    const files = listTraceFiles(sessionDir)
    expect(files.length).toBe(2)
    expect(files.some((f) => f.endsWith('-request.json'))).toBe(true)
    expect(files.some((f) => f.endsWith('-response.json'))).toBe(true)

    const reqFile = files.find((f) => f.endsWith('-request.json'))!
    const reqContent = JSON.parse(fs.readFileSync(path.join(sessionDir, reqFile), 'utf-8')) as {
      meta: { sessionId: string }
      body: { messages: Array<{ content: string }> }
    }
    expect(reqContent.meta.sessionId).toBe(sessionId)
    expect(reqContent.body.messages[0].content).toBe('hi')

    const respFile = files.find((f) => f.endsWith('-response.json'))!
    const respContent = JSON.parse(fs.readFileSync(path.join(sessionDir, respFile), 'utf-8')) as {
      meta: { responseStatus: number }
      body: { ok: boolean }
    }
    expect(respContent.meta.responseStatus).toBe(200)
    expect(respContent.body.ok).toBe(true)
  })

  it('should use no-session dir when x-conversation-id header missing', async () => {
    const traceDir = mkdtempTrace()
    const proxy = await startProxy({
      port: 0,
      apiBaseUrl: `http://127.0.0.1:${upstreamPort}`,
      traceDir,
    })

    const testBody = JSON.stringify({ msg: 'no session' })
    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: proxy.port,
          path: '/v2/messages',
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(testBody).toString(),
          },
        },
        (res) => {
          res.resume()
          res.on('end', resolve)
        },
      )
      req.on('error', reject)
      req.write(testBody)
      req.end()
    })

    await stopProxy(proxy)

    const noSessionDir = path.join(traceDir, 'no-session')
    expect(fs.existsSync(noSessionDir)).toBe(true)
    const files = listTraceFiles(noSessionDir)
    expect(files.length).toBe(2)
  })

  it('should not write trace files when traceDir is not set', async () => {
    const proxy = await startProxy({
      port: 0,
      apiBaseUrl: `http://127.0.0.1:${upstreamPort}`,
    })
    expect(proxy.traceDir).toBeUndefined()

    const testBody = JSON.stringify({ x: 1 })
    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: proxy.port,
          path: '/v2/messages',
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-conversation-id': 'abc',
            'content-length': Buffer.byteLength(testBody).toString(),
          },
        },
        (res) => {
          res.resume()
          res.on('end', resolve)
        },
      )
      req.on('error', reject)
      req.write(testBody)
      req.end()
    })

    await stopProxy(proxy)
  })

  it.each(['prompt_suggestion', 'memory_selection', 'conversation_topic'])(
    'should skip trace when x-agent-purpose is %s',
    async (purpose) => {
      const traceDir = mkdtempTrace()
      const proxy = await startProxy({
        port: 0,
        apiBaseUrl: `http://127.0.0.1:${upstreamPort}`,
        traceDir,
      })

      const testBody = JSON.stringify({ purpose })
      await new Promise<void>((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: proxy.port,
            path: '/v2/messages',
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-conversation-id': 'skip-test',
              'x-agent-purpose': purpose,
              'content-length': Buffer.byteLength(testBody).toString(),
            },
          },
          (res) => {
            res.resume()
            res.on('end', resolve)
          },
        )
        req.on('error', reject)
        req.write(testBody)
        req.end()
      })

      await stopProxy(proxy)

      const skipDir = path.join(traceDir, 'skip-test')
      expect(fs.existsSync(skipDir)).toBe(false)
    },
  )
})
