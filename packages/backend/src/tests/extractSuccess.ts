import { Assert, type Result as TResult } from "@guillaume-docquier/tools-ts"

export function extractSuccess<TSuccess>(result: TResult<TSuccess, unknown>): TSuccess {
  Assert.isSuccess(result)
  return result.value
}
