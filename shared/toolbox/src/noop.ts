/**
 * Does nothing.
 * Usually used a default parameter for optional callbacks.
 */
export function noop(): void {}

/**
 * Asynchronously does nothing.
 * Usually used a default parameter for async optional callbacks.
 */
export async function asyncNoop(): Promise<void> {}
