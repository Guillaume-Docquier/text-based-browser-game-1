import type { Query } from "@tanstack/react-query"

export const protectAgainstInvalidationMeta = { protectAgainstInvalidation: true } as const

export function unlessProtected(query: Query): boolean {
  return query.meta?.protectAgainstInvalidation !== true
}
