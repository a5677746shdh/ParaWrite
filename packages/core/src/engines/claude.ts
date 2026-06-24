import type { ProviderConfig } from '../types.js'
import type { ChatRequest } from '../types.js'
import { collectStream, type IEngine } from './base.js'

interface ClaudeStreamEvent {
  type: string
  delta?: { type?: string; text?: string }
}

export class ClaudeEngine implements IEngine {
  constructor(private readonly provider: ProviderConfig) {}

  async *chatStream(req: ChatRequest): AsyncIterable<string> {
    const baseUrl = this.provider.base_url.replace(/\/$/, '')
    const path = this.provider.api_path ?? '/v1/messages'
    const url = `${baseUrl}${path}`

    const systemMessage = req.messages.find((m) => m.role === 'system')?.content ?? ''
    const userMessages = req.messages.filter((m) => m.role !== 'system')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.provider.api_key ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: req.model,
        max_tokens: 4096,
        system: systemMessage,
        messages: userMessages.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
        stream: true,
        temperature: req.temperature ?? 0.3,
      }),
      signal: req.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Claude API error ${response.status}: ${errorText}`)
    }

    if (!response.body) {
      throw new Error('No response body from Claude API')
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
        if (!data || data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data) as ClaudeStreamEvent
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            yield parsed.delta.text
          }
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
