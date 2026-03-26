/**
 * A Result is either a Success or a Failure.
 * You can use the Result utility functions to work nicely with Results
 */
export type Result<TValue, TError> = Success<TValue> | Failure<TError>

export interface Success<TValue> {
  type: "Success"
  value: TValue
}

export interface Failure<TError> {
  type: "Failure"
  error: TError
}

/**
 * Utility functions to work with Results.
 * @example
 * ```ts
 * const result: Result<number, string> = Result.Success(1)
 * if (Result.isSuccess(result)) {
 *   return result.value // Type safe!
 * }
 *
 * return result.error // Type safe!
 * ```
 */

export const Result = {
  /**
   * Creates a Success
   */
  Success: <TValue>(value: TValue): Success<TValue> => ({ type: "Success", value }),

  /**
   * A Success type guard
   */
  isSuccess: <TValue>(maybeSuccess: Result<TValue, unknown>): maybeSuccess is Success<TValue> => {
    return maybeSuccess.type === "Success"
  },

  /**
   * Creates a Failure
   */
  Failure: <TError>(error: TError): Failure<TError> => ({ type: "Failure", error }),

  /**
   * A Failure type guard
   */
  isFailure: <TError>(maybeFailure: Result<unknown, TError>): maybeFailure is Failure<TError> => {
    return maybeFailure.type === "Failure"
  },

  // You can overload while defining object properties, which is why the function implementation is not inlined
  tryCatch,
}

/**
 * Creates a Result from the result of a promise.
 * If the promise resolves, you will get a {@link Result.Success}.
 * If the promise rejects, you will get a {@link Result.Failure}.
 *
 * @param fn The callback to execute.
 */
function tryCatch<T>(fn: () => Promise<T>): Promise<Result<T, unknown>>
/**
 * Creates a Result from the result of a function that could throw.
 * If the function does not throw, you will get a {@link Result.Success}.
 * If the function throws, you will get a {@link Result.Failure}.
 *
 * @param fn The callback to execute.
 */
function tryCatch<T>(fn: () => T): Result<T, unknown>
function tryCatch<T>(fn: () => T | Promise<T>): Result<T, unknown> | Promise<Result<T, unknown>> {
  try {
    const result = fn()

    // Async handling
    if (result instanceof Promise) {
      return result.then(Result.Success).catch(Result.Failure)
    }

    // Sync handling
    return Result.Success(result)
  } catch (error) {
    return Result.Failure(error)
  }
}
