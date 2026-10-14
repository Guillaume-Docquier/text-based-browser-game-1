import { Assert } from "@guillaume-docquier/tools-ts"

/** Return a present fixture value, failing the scenario immediately when it is missing. */
export function required<Value>(value: Value | null | undefined): Value {
  Assert.isDefined(value)
  return value
}
