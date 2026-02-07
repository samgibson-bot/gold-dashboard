const isProduction = process.env.NODE_ENV === 'production'

export function sanitizeError(err: unknown): string {
  if (!isProduction) {
    return err instanceof Error ? err.message : String(err)
  }

  if (err instanceof Error) {
    const msg = err.message
    if (
      msg.includes('session not found') ||
      msg.includes('required') ||
      msg.includes('timed out') ||
      msg.includes('Missing gateway auth') ||
      msg.includes('Gateway unavailable')
    ) {
      return msg
    }
  }

  return 'Internal server error'
}
