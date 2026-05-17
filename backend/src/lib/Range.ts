import z from "zod"

const RawRange = z.object({
  /**
   * Inclusive
   */
  min: z.number(),

  /**
   * Inclusive
   */
  max: z.number(),
})

/**
 * A Range of values
 * The Range bounds are both inclusive
 */
export type Range = z.infer<typeof Range>
export const Range = RawRange.refine(({ min, max }) => min <= max, { message: "Range min must be lower than or equal to max" })

/**
 * A Range for percentage values between [0, 1]
 * The Range bounds are both inclusive
 *
 * We might want to use Branded types for this in the future
 */
export type PercentageRange = z.infer<typeof PercentageRange>
export const PercentageRange = RawRange.extend({
  /**
   * Inclusive
   */
  min: z.number().min(0).max(1),

  /**
   * Inclusive
   */
  max: z.number().min(0).max(1),
}).refine(({ min, max }) => min <= max, { message: "Range min must be lower than or equal to max" })

/**
 * A Range for integer values greater than or equal to 0
 * The Range bounds are both inclusive
 *
 * We might want to use Branded types for this in the future
 */
export type IntegerRange = z.infer<typeof IntegerRange>
export const IntegerRange = RawRange.extend({
  /**
   * Inclusive
   */
  min: z.number().int().min(0),

  /**
   * Inclusive
   */
  max: z.number().int().min(0),
}).refine(({ min, max }) => min <= max, { message: "Range min must be lower than or equal to max" })
