/** Thrown when device STT can't be used → caller falls back to the server. */
export class SttFallback extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'SttFallback'
  }
}
