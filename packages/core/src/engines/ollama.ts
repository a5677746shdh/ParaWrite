import type { ProviderConfig } from '../types.js'
import type { ChatRequest } from '../types.js'
import { collectStream, type EngineFetch, type IEngine } from './base.js'

interface OllamaStreamChunk {
  message?: { content?: string }
  done?: boolean
}

export class OllamaEngine implements IEngine {
  constructor(
    private readonly provider: ProviderConfig,
    private readonly proxiedFetch: EngineFetch
  ) {}

  async *chatStream(req: ChatRequest): AsyncIterable<string> {
    const baseUrl = this.provider.base_url.replace(/\/$/, '')
    const url = `${baseUrl}/api/chat`

    const response = await this.proxiedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        stream: true,
        options: {
          temperature: req.temperature ?? 0.3,
        },
      }),
      signal: req.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Ollama API error ${response.status}: ${errorText}`)
    }

    if (!response.body) {
      throw new Error('No response body from Ollama API')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const parsed = JSON.parse(line) as OllamaStreamChunk
          const content = parsed.message?.content
          if (content) yield content
          if (parsed.done) return
        } catch {
          // skip malformed chunks
        }
      }
    }
  }

  async chat(req: ChatRequest): Promise<string> {
    return collectStream(this.chatStream(req))
  }
}
