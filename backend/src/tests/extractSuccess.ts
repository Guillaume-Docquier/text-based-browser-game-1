import { Result, type Result as TResult } from "@guillaume-docquier/tools-ts"

/**
 * Extracts the success from a Result.
 * This is a test utility when we expect operations to succeed.
 * If the result was a Failure, this will throw.
 */
export function extractSuccess<TSuccess>(result: TResult<TSuccess, unknown>): TSuccess {
  if (Result.isFailure(result)) {
    throw new Error(String(result.error))
  }

  return result.value
}
