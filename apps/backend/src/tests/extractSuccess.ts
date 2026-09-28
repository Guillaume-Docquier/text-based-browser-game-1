import { Assert, type Result as TResult } from "@guillaume-docquier/tools-ts"

/**
 * Extracts the success from a Result.
 * This is a test utility when we expect operations to succeed and need the value.
 * If the result was a Failure, this will throw.
 *
 * If we only expect the operation to succeed, but we don't care about the value, prefer using `Assert.isSuccess(result)` instead
 */
export function extractSuccess<TSuccess>(result: TResult<TSuccess, unknown>): TSuccess {
  Assert.isSuccess(result)
  return result.value
}
