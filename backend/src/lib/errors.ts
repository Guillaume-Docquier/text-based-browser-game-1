/**
 * A generic helper for errors that should not be disclosed to users.
 *
 * @example
 * ```ts
 * if (Result.isFailure(createResult)) {
 *   this.logger.error("Could not create game", { newGame, error: createResult.error })
 *   return Result.Failure(couldNot("create game"))
 * }
 * ```
 */
export function couldNot(operationName: string): string {
  return `Could not ${operationName}, see logs for more details.`
}

/**
 * A generic helper for errors due to lack of authorization.
 *
 * @example
 * ```ts
 * ```
 */
export function notAuthorized({ playerId, operationName }: { playerId: number; operationName: string }): string {
  return `Player with id ${playerId} is not authorized to ${operationName}`
}

/**
 * You roll back transactions by throwing errors.
 * The built-in drizzle functionality for this is to call tx.rollback(), which throws an error.
 * However, TS doesn't know that it throws and breaks the control flow semantics, notably when dealing with Results.
 */
export class TransactionRollback extends Error {}
