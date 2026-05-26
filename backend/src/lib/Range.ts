import { z } from "zod"
import { Range, type ExclusiveRange, type InclusiveRange } from "@guillaume-docquier/tools-ts"

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

export const InclusiveFloatRangeDto: z.ZodType<InclusiveRange<"float">> = z
  .object({
    type: z.literal("MaxInclusive"),
    numericType: z.literal("float"),
    min: z.number(),
    maxInclusive: z.number(),
    get limits() {
      return FloatRangeDto.exactOptional()
    },
  })
  .superRefine((range, context) => {
    const invalidReason = Range.validate(range)
    if (invalidReason !== undefined) {
      context.addIssue({ code: "custom", message: invalidReason })
    }
  })

export const InclusiveIntegerRangeDto: z.ZodType<InclusiveRange<"integer">> = z
  .object({
    type: z.literal("MaxInclusive"),
    numericType: z.literal("integer"),
    min: z.number(),
    maxInclusive: z.number(),
    get limits() {
      return IntegerRangeDto.exactOptional()
    },
  })
  .superRefine((range, context) => {
    const invalidReason = Range.validate(range)
    if (invalidReason !== undefined) {
      context.addIssue({ code: "custom", message: invalidReason })
    }
  })

export const ExclusiveFloatRangeDto: z.ZodType<ExclusiveRange<"float">> = z
  .object({
    type: z.literal("MaxExclusive"),
    numericType: z.literal("float"),
    min: z.number(),
    maxExclusive: z.number(),
    get limits() {
      return FloatRangeDto.exactOptional()
    },
  })
  .superRefine((range, context) => {
    const invalidReason = Range.validate(range)
    if (invalidReason !== undefined) {
      context.addIssue({ code: "custom", message: invalidReason })
    }
  })

export const ExclusiveIntegerRangeDto: z.ZodType<ExclusiveRange<"integer">> = z
  .object({
    type: z.literal("MaxExclusive"),
    numericType: z.literal("integer"),
    min: z.number(),
    maxExclusive: z.number(),
    get limits() {
      return IntegerRangeDto.exactOptional()
    },
  })
  .superRefine((range, context) => {
    const invalidReason = Range.validate(range)
    if (invalidReason !== undefined) {
      context.addIssue({ code: "custom", message: invalidReason })
    }
  })

const FloatRangeDto = z.union([InclusiveFloatRangeDto, ExclusiveFloatRangeDto])
const IntegerRangeDto = z.union([InclusiveIntegerRangeDto, ExclusiveIntegerRangeDto])

export const RangeDto: z.ZodType<Range> = z.union([FloatRangeDto, IntegerRangeDto])
