import { z } from "zod"
import { Range, type ExclusiveRange, type InclusiveRange, type Range as RangeType } from "@guillaume-docquier/tools-ts"

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

export const InclusiveFloatRangeDto: z.ZodType<InclusiveRange<"float">> = z.lazy(() =>
  z
    .object({
      type: z.literal("MaxInclusive"),
      numericType: z.literal("float"),
      min: z.number(),
      maxInclusive: z.number(),
      limits: FloatRangeDto.optional(),
    })
    .superRefine((range, context) => {
      const invalidReason = Range.validate(range)
      if (invalidReason !== undefined) {
        context.addIssue({ code: "custom", message: invalidReason })
      }
    }),
)

export const InclusiveIntegerRangeDto: z.ZodType<InclusiveRange<"integer">> = z.lazy(() =>
  z
    .object({
      type: z.literal("MaxInclusive"),
      numericType: z.literal("integer"),
      min: z.number(),
      maxInclusive: z.number(),
      limits: IntegerRangeDto.optional(),
    })
    .superRefine((range, context) => {
      const invalidReason = Range.validate(range)
      if (invalidReason !== undefined) {
        context.addIssue({ code: "custom", message: invalidReason })
      }
    }),
)

export const ExclusiveFloatRangeDto: z.ZodType<ExclusiveRange<"float">> = z.lazy(() =>
  z
    .object({
      type: z.literal("MaxExclusive"),
      numericType: z.literal("float"),
      min: z.number(),
      maxExclusive: z.number(),
      limits: FloatRangeDto.optional(),
    })
    .superRefine((range, context) => {
      const invalidReason = Range.validate(range)
      if (invalidReason !== undefined) {
        context.addIssue({ code: "custom", message: invalidReason })
      }
    }),
)

export const ExclusiveIntegerRangeDto: z.ZodType<ExclusiveRange<"integer">> = z.lazy(() =>
  z
    .object({
      type: z.literal("MaxExclusive"),
      numericType: z.literal("integer"),
      min: z.number(),
      maxExclusive: z.number(),
      limits: IntegerRangeDto.optional(),
    })
    .superRefine((range, context) => {
      const invalidReason = Range.validate(range)
      if (invalidReason !== undefined) {
        context.addIssue({ code: "custom", message: invalidReason })
      }
    }),
)

const FloatRangeDto: z.ZodType<RangeType<"float">> = z.union([InclusiveFloatRangeDto, ExclusiveFloatRangeDto])

const IntegerRangeDto: z.ZodType<RangeType<"integer">> = z.union([InclusiveIntegerRangeDto, ExclusiveIntegerRangeDto])

export const RangeDto: z.ZodType<RangeType> = z.union([FloatRangeDto, IntegerRangeDto])
