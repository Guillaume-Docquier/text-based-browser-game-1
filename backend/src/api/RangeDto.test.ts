import { describe, expect, it } from "vitest"
import { Range } from "@guillaume-docquier/tools-ts"
import { RangeDto } from "#api/RangeDto.ts"

describe("RangeDto", () => {
  it("should parse a valid Range", () => {
    const range = Range.create({
      numericType: "float",
      maxBoundType: "exclusive",
      min: 0,
      max: 1,
    })

    expect(RangeDto.parse(range)).toEqual(range)
  })

  it("should return the Range validation error as a Zod error", () => {
    const parseResult = RangeDto.safeParse({
      numericType: "float",
      maxBoundType: "exclusive",
      min: 1,
      max: 1,
    })

    expect(parseResult.success).toBe(false)
    if (parseResult.success) {
      throw new Error("Expected RangeDto parsing to fail")
    }
    expect(parseResult.error.issues).toEqual([
      expect.objectContaining({
        code: "custom",
        message: "Min must be smaller than the exclusive max",
        path: [],
      }),
    ])
  })
})
