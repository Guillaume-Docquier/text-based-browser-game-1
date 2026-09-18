import { Result, type Success } from "@guillaume-docquier/tools-ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"

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
