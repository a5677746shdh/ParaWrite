/** True when the client disconnected or aborted the in-flight request. */
export function isClientAbort(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true
  if (!error || typeof error !== 'object') return false

  const err = error as { name?: string; code?: string; message?: string }
  if (err.name === 'AbortError') return true
  if (err.code === 'ABORT_ERR') return true

  const message = err.message?.toLowerCase() ?? ''
  return (
    message.includes('aborted') ||
    message.includes('abort') ||
    message.includes('cancelled') ||
    message.includes('canceled')
  )
}
