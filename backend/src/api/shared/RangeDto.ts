import type { Range } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export const RangeDto = z.object({
  numericType: z.enum(["float", "integer"]),
  maxBoundType: z.enum(["inclusive", "exclusive"]),
  min: z.number(),
  max: z.number(),
}) satisfies z.ZodType<Range>
