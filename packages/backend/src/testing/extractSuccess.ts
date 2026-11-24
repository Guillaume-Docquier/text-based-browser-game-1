import { Assert, type Result } from "@guillaume-docquier/tools-ts"

export function extractSuccess<TSuccess>(result: Result<TSuccess, unknown>): TSuccess {
  Assert.isSuccess(result)
  return result.value
}
