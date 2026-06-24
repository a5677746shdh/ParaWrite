import { fetch as undiciFetch, ProxyAgent, Socks5ProxyAgent } from 'undici'
import type { ProxyConfig } from './types.js'

export type EngineFetch = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>

let dispatcherCache: { url: string; dispatcher: ProxyAgent | Socks5ProxyAgent } | null =
  null

function createDispatcher(proxyUrl: string): ProxyAgent | Socks5ProxyAgent {
  const parsed = new URL(proxyUrl)
  const protocol = parsed.protocol.replace(':', '').toLowerCase()

  if (protocol === 'socks5' || protocol === 'socks5h' || protocol === 'socks4') {
    return new Socks5ProxyAgent(proxyUrl)
  }

  if (protocol === 'http' || protocol === 'https') {
    return new ProxyAgent(proxyUrl)
  }

  throw new Error(
    `Unsupported proxy protocol "${protocol}". Use http, https, socks5, or socks5h.`
  )
}

export function createProxiedFetch(proxy?: ProxyConfig): EngineFetch {
  const proxyUrl = proxy?.url?.trim()
  if (!proxyUrl) {
    return (input, init) => undiciFetch(input, init as Parameters<typeof undiciFetch>[1])
  }

  if (!dispatcherCache || dispatcherCache.url !== proxyUrl) {
    dispatcherCache = { url: proxyUrl, dispatcher: createDispatcher(proxyUrl) }
  }

  const dispatcher = dispatcherCache.dispatcher
  return (input, init) =>
    undiciFetch(input, { ...init, dispatcher } as Parameters<typeof undiciFetch>[1])
}

export function resetProxiedFetchCache(): void {
  dispatcherCache = null
}
