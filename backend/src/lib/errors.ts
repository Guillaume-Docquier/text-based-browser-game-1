import { Result, type Success } from "@guillaume-docquier/tools-ts"

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
 * You roll back transactions by throwing errors.
 * The built-in drizzle functionality for this is to call tx.rollback(), which throws an error.
 * However, TS doesn't know that it throws and breaks the control flow semantics, notably when dealing with Results.
 */
export class TransactionRollbackError extends Error {
  public constructor(message: string, options: ErrorOptions) {
    super(message, options)
    this.name = "TransactionRollbackError"
  }
}

/**
 * Throws a {@link TransactionRollbackError} error with message if the result is a {@link Failure}.
 * Additionally, asserts that the result is a {@link Success}, so you can use its value afterward.
 * Useful during transactions when dealing with {@link Result}
 *
 * @example
 * ```ts
 * return await createTransaction(async (tx): Promise<void> => {
 *   const doSomethingResult = await this.doSomething(something, tx)
 *   rollbackOnFailure(doSomethingResult, "Failed to do something")
 *
 *   const didSomethingResult = await this.handleDidSomething(doSomethingResult.value, tx)
 *   rollbackOnFailure(didSomethingResult, "Failed to handle what we did")
 *
 *   return didSomethingResult.value
 * }),
 * ```
 */
export function rollbackOnFailure<TSuccess>(result: Result<TSuccess, unknown>, message: string): asserts result is Success<TSuccess> {
  if (Result.isFailure(result)) {
    throw new TransactionRollbackError(message, { cause: result.error })
  }
}
