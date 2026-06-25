/**
 * LLM engine interface and shared chat helpers.
 * Concrete engines (OpenAI-compatible, Claude, Ollama) implement IEngine.
 */
import type { ChatMessage, ChatRequest } from '../types.js'
import type { EngineFetch } from '../proxy-fetch.js'

export type { EngineFetch } from '../proxy-fetch.js'

export interface IEngine {
  chatStream(req: ChatRequest): AsyncIterable<string>
  chat(req: ChatRequest): Promise<string>
}

export async function collectStream(stream: AsyncIterable<string>): Promise<string> {
  let result = ''
  for await (const chunk of stream) {
    result += chunk
  }
  return result
}

export function buildMessages(
  system: string,
  user: string
): ChatMessage[] {
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}
