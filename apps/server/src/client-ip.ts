/** Best-effort client IP from reverse-proxy headers. */
export function getClientIp(c: {
  req: { header: (name: string) => string | undefined }
}): string | undefined {
  const xff = c.req.header('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const xri = c.req.header('x-real-ip')?.trim()
  if (xri) return xri
  const cf = c.req.header('cf-connecting-ip')?.trim()
  if (cf) return cf
  return undefined
}
