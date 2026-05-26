import { z } from "zod"
import { Range, type ExclusiveRange, type InclusiveRange } from "@guillaume-docquier/tools-ts"

function withRangeValidation<TRange extends Range>(dto: z.ZodType<TRange>): z.ZodType<TRange> {
  return dto.superRefine((range, context) => {
    const invalidReason = Range.validate(range)
    if (invalidReason !== undefined) {
      context.addIssue({ code: "custom", message: invalidReason })
    }
  })
}

export const InclusiveFloatRangeDto: z.ZodType<InclusiveRange<"float">> = withRangeValidation(
  z.object({
    type: z.literal("MaxInclusive"),
    numericType: z.literal("float"),
    min: z.number(),
    maxInclusive: z.number(),
    get limits() {
      return FloatRangeDto.exactOptional()
    },
  }),
)

export const InclusiveIntegerRangeDto: z.ZodType<InclusiveRange<"integer">> = withRangeValidation(
  z.object({
    type: z.literal("MaxInclusive"),
    numericType: z.literal("integer"),
    min: z.number(),
    maxInclusive: z.number(),
    get limits() {
      return IntegerRangeDto.exactOptional()
    },
  }),
)

export const ExclusiveFloatRangeDto: z.ZodType<ExclusiveRange<"float">> = withRangeValidation(
  z.object({
    type: z.literal("MaxExclusive"),
    numericType: z.literal("float"),
    min: z.number(),
    maxExclusive: z.number(),
    get limits() {
      return FloatRangeDto.exactOptional()
    },
  }),
)

export const ExclusiveIntegerRangeDto: z.ZodType<ExclusiveRange<"integer">> = withRangeValidation(
  z.object({
    type: z.literal("MaxExclusive"),
    numericType: z.literal("integer"),
    min: z.number(),
    maxExclusive: z.number(),
    get limits() {
      return IntegerRangeDto.exactOptional()
    },
  }),
)

const FloatRangeDto = z.union([InclusiveFloatRangeDto, ExclusiveFloatRangeDto])
const IntegerRangeDto = z.union([InclusiveIntegerRangeDto, ExclusiveIntegerRangeDto])

export const RangeDto: z.ZodType<Range> = z.union([FloatRangeDto, IntegerRangeDto])
