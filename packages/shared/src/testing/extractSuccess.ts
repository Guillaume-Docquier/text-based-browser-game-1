import { Assert, type Result } from "@guillaume-docquier/tools-ts"
export function extractSuccess<T>(result: Result<T, unknown>): T {
  Assert.isSuccess(result)
  return result.value
}
