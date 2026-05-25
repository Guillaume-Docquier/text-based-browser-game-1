import { z } from "zod"
import { Range } from "@guillaume-docquier/tools-ts"

/**
 * A base Range to represent what percentages are.
 * It can be used with {@link Range.from} to derive more Percentage Ranges.
 */
export const PercentageRange = Range.createMaxInclusive({
  numericType: "float",
  min: 0,
  maxInclusive: 1,
  limits: Range.createMaxInclusive({
    min: 0,
    maxInclusive: 1,
    numericType: "float",
  }),
})

export const RangeDto: z.ZodType<Range> = z.lazy(() =>
  z
    .discriminatedUnion("type", [
      z.object({
        type: z.literal("MaxInclusive"),
        numericType: z.enum(["float", "integer"]),
        min: z.number(),
        maxInclusive: z.number(),
        limits: RangeDto.optional(),
      }),
      z.object({
        type: z.literal("MaxExclusive"),
        numericType: z.enum(["float", "integer"]),
        min: z.number(),
        maxExclusive: z.number(),
        limits: RangeDto.optional(),
      }),
    ])
    .superRefine((range, context) => {
      const invalidReason = Range.validate(range)
      if (invalidReason !== undefined) {
        context.addIssue({ code: "custom", message: invalidReason })
      }
    }),
)
