// apps/web/src/lib/pipeline/budget.ts
import "server-only"

/** Hard ceiling for /api/pipeline/incident. Optional stages drop when this is spent. */
export const PIPELINE_BUDGET_MS = 8_000

export type PipelineBudget = {
  remaining: () => number
  expired: () => boolean
  has: (minMs: number) => boolean
}

export function createBudget(totalMs = PIPELINE_BUDGET_MS): PipelineBudget {
  const deadline = Date.now() + totalMs
  return {
    remaining: () => Math.max(0, deadline - Date.now()),
    expired: () => Date.now() >= deadline,
    has: (minMs: number) => deadline - Date.now() >= minMs,
  }
}
