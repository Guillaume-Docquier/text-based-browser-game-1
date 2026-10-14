import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

/**
 * A safe whole number that may be zero, used for mutable counts and zero-state cleanup.
 */
export type NonNegativeSafeInteger = Branded<"NonNegativeSafeInteger", number>

/**
 * Parses an exact nonnegative integer that JavaScript can represent safely.
 */
export const NonNegativeSafeIntegerSchema = z
  .number()
  .int()
  .nonnegative()
  .refine(Number.isSafeInteger, "Expected a safe integer")
  .transform(branded<NonNegativeSafeInteger>) satisfies z.ZodType<NonNegativeSafeInteger>
