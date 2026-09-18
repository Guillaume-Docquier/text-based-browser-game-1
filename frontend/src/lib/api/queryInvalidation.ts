import type { Query } from "@tanstack/react-query"

/**
 * Marks a query as excluded from application-wide cache invalidation.
 */
export const skipGlobalInvalidationMeta = { skipGlobalInvalidation: true } as const

/**
 * Determines whether a query participates in application-wide cache invalidation.
 *
 * @param query - The cached query being considered for invalidation.
 * @returns Whether the query should be invalidated.
 */
export function shouldGloballyInvalidateQuery(query: Query): boolean {
  return query.meta?.skipGlobalInvalidation !== true
}
