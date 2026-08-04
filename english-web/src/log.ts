import { getToken } from './api'

/** Emit ONE wide, structured event per unit of work (loggingsucks.com style):
 *  high-dimensionality JSON to the console AND shipped to the server logs
 *  (journalctl -u hayyabaca -g ENGLISH_EVENT) so we can debug remotely. */
export function logEvent(event: string, attrs: Record<string, unknown>): void {
  const payload = {
    event,
    ts: new Date().toISOString(),
    ua: navigator.userAgent,
    ...attrs,
  }
  // eslint-disable-next-line no-console
  console.log('[wide]', payload)
  try {
    const token = getToken()
    void fetch('/api/english/events/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Token ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* logging must never break the app */
  }
}
