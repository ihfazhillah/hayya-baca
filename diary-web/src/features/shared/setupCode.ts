// Extract the one-time setup/reset code from a scanned QR payload. The QR the
// guardian shows encodes a URL like ".../setup?code=ABC123", but we also accept
// a bare code so typing/pasting works. Returns the upper-cased code, or null.
export function parseSetupCode(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null

  const fromQuery = raw.match(/[?&]code=([^&\s]+)/i)
  if (fromQuery) return decodeURIComponent(fromQuery[1]).trim().toUpperCase()

  // A bare code: letters/digits only, no URL characters.
  if (/^[a-z0-9]+$/i.test(raw)) return raw.toUpperCase()

  return null
}
