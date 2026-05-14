import { Assert, Result, type Result as TResult } from "@guillaume-docquier/tools-ts"

export function extractSuccess<TSuccess>(result: TResult<TSuccess, unknown>): TSuccess {
  Assert.isTrue(Result.isSuccess(result))

  return result.value
}
