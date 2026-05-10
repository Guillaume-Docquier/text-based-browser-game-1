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
