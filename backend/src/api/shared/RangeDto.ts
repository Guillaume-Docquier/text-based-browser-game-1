import { Range, Result } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export const RangeDto = z
  .object({
    numericType: z.enum(["float", "integer"]),
    maxBoundType: z.enum(["inclusive", "exclusive"]),
    min: z.number(),
    max: z.number(),
  })
  .superRefine((range, context) => {
    const rangeResult = Range.safeCreate(range)
    if (Result.isFailure(rangeResult)) {
      context.addIssue({
        code: "custom",
        message: rangeResult.error,
      })
    }
  }) satisfies z.ZodType<Range>
