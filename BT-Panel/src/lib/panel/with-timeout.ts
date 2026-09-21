/**
 * Tiny shared timeout race: a dropped request/response (dead relay socket)
 * must never leave a UI waiting forever. Resolves `null` on timeout.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), ms)),
  ]);
}
