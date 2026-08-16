// apps/web/src/lib/notify/retry.ts
import "server-only";

import { isTransientNotifyError, NotConfiguredError } from "@/lib/notify/errors";

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Three attempts, exponential backoff, transient failures only. */
export async function withTransientRetry<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (error instanceof NotConfiguredError) throw error;
      if (!isTransientNotifyError(error) || attempt === MAX_ATTEMPTS - 1) {
        throw error;
      }
      await sleep(BASE_DELAY_MS * 2 ** attempt);
    }
  }
  throw last instanceof Error ? last : new Error("retry exhausted");
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return "unknown error";
}
