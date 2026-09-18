import type { Query } from "@tanstack/react-query"

/**
 * Marks a query as excluded from application-wide cache invalidation.
 */
export const protectAgainstInvalidationMeta = { protectAgainstInvalidation: true } as const

/**
 * Invalidates all queries, except those with {@link protectAgainstInvalidationMeta}.
 * Protected queries are very rare.
 */
export function unlessProtected(query: Query): boolean {
  return query.meta?.skipGlobalInvalidation !== true
}
