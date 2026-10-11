import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
/** Safe whole fleet Strength, including zero for terminal cleanup. */
export type FleetStrength = Branded<"FleetStrength", number>
export const FleetStrengthSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER)
  .transform(branded<FleetStrength>)
