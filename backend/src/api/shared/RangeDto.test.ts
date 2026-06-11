import { Assert, Range } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { RangeDto } from "#api/shared/RangeDto.ts"

describe("RangeDto", () => {
  it("should parse a valid Range", () => {
    // Arrange
    const range = Range.create({
      numericType: "float",
      maxBoundType: "exclusive",
      min: 0,
      max: 1,
    })

    // Act
    const parsedRange = RangeDto.parse(range)

    // Assert
    expect(parsedRange).toEqual(range)
  })

  it("should return the Range validation error as a Zod error", () => {
    // Act
    const parseResult = RangeDto.safeParse({
      numericType: "float",
      maxBoundType: "exclusive",
      min: 1,
      max: 1,
    })

    // Assert
    Assert.isTrue(!parseResult.success)
    expect(parseResult.error.issues).toEqual([
      expect.objectContaining({
        code: "custom",
        message: "Min must be smaller than the exclusive max",
        path: [],
      }),
    ])
  })
})
