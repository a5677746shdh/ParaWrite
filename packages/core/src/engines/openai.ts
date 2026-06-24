import type { ProviderConfig } from '../types.js'
import type { ChatRequest } from '../types.js'
import { collectStream, type EngineFetch, type IEngine } from './base.js'

interface OpenAIStreamChunk {
  choices?: Array<{
    delta?: { content?: string }
    finish_reason?: string | null
  }>
}

export class OpenAICompatibleEngine implements IEngine {
  constructor(
    private readonly provider: ProviderConfig,
    private readonly proxiedFetch: EngineFetch
  ) {}

  async *chatStream(req: ChatRequest): AsyncIterable<string> {
    const url = `${this.provider.base_url.replace(/\/$/, '')}/chat/completions`
    const response = await this.proxiedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.provider.api_key
          ? { Authorization: `Bearer ${this.provider.api_key}` }
          : {}),
      },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        temperature: req.temperature ?? 0.3,
        stream: true,
      }),
      signal: req.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error ${response.status}: ${errorText}`)
    }

    if (!response.body) {
      throw new Error('No response body from OpenAI API')
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
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') return

        try {
          const parsed = JSON.parse(data) as OpenAIStreamChunk
          const content = parsed.choices?.[0]?.delta?.content
          if (content) yield content
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
