export function canUseClipboardApi(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof navigator !== 'undefined' &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  )
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

export function copyToClipboard(text: string): Promise<boolean> {
  if (!canUseClipboardApi()) {
    return Promise.resolve(copyWithExecCommand(text))
  }

  return navigator.clipboard!.writeText(text).then(
    () => true,
    () => copyWithExecCommand(text)
  )
}
