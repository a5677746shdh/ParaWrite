export function canUseClipboardApi(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof navigator !== 'undefined' &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  )
}

function createPasteTarget(): HTMLTextAreaElement {
  const textarea = document.createElement('textarea')
  textarea.setAttribute('autocomplete', 'off')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  return textarea
}

/** Legacy paste fallback for HTTP or browsers without clipboard.readText. */
function pasteWithExecCommand(target?: HTMLTextAreaElement | null): string | null {
  const el = target ?? createPasteTarget()
  const detached = !target

  el.focus()
  const before = el.value

  let ok = false
  try {
    ok = document.execCommand('paste')
  } catch {
    if (detached) document.body.removeChild(el)
    return null
  }

  const text = el.value
  if (detached) document.body.removeChild(el)

  if (!ok) return null
  if (target) return text !== before ? text : text || null
  return text || null
}

/**
 * Read clipboard text: Clipboard API first, then execCommand paste on user gesture.
 * Works on HTTP deploys where readText is blocked but paste may still succeed.
 */
export async function pasteFromClipboard(
  target?: HTMLTextAreaElement | null
): Promise<string | null> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
    try {
      const text = await navigator.clipboard.readText()
      if (text) return text
    } catch {
      // insecure context, permission denied, etc.
    }
  }

  return pasteWithExecCommand(target)
}

export function copyWithExecCommand(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, text.length)

  let ok = false
  try {
    ok = document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }

  return ok
}
