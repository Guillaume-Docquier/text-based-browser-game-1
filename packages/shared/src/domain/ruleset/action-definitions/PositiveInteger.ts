import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

/**
 * A positive safe integer used for discrete gameplay inputs and turn numbers.
 */
export type PositiveInteger = Branded<"PositiveInteger", number>

/**
 * Parses a positive integer that can be represented exactly by JavaScript.
 */
export const PositiveIntegerSchema = z
  .number()
  .int()
  .positive()
  .refine(Number.isSafeInteger, "Expected a safe integer")
  .transform(branded<PositiveInteger>) satisfies z.ZodType<PositiveInteger>
