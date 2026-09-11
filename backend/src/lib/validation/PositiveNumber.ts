import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

/**
 * A positive number is >0
 * 0 is neither positive nor negative.
 */
export type PositiveNumber = Branded<"PositiveNumber", number>

/**
 * A positive number is >0
 * 0 is neither positive nor negative.
 */
export const PositiveNumberSchema = z
  .number()
  .positive()
  .transform(branded<PositiveNumber>)
