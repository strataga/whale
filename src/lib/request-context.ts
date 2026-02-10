import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  startTime: number;
}

export const requestStore = new AsyncLocalStorage<RequestContext>();

/**
 * Get the current request context (if running inside a request).
 */
export function getRequestContext(): RequestContext | undefined {
  return requestStore.getStore();
}

/**
 * Get the current request ID (or "unknown" if not in a request context).
 */
export function getRequestId(): string {
  return requestStore.getStore()?.requestId ?? "unknown";
}

/**
 * Run a function with a request context.
 */
export function runWithRequestContext<T>(
  ctx: RequestContext,
  fn: () => T,
): T {
  return requestStore.run(ctx, fn);
}
