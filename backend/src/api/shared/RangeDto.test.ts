import { Range } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { RangeDto } from "#api/shared/RangeDto.ts"

describe("RangeDto", () => {
  it("should parse a valid Range", () => {
    // Arrange
    const range = Range.float({ min: 0, max: 1 })

    // Act
    const parsedRange = RangeDto.parse(range)

    // Assert
    expect(parsedRange).toEqual(range)
  })

  it("should only parse the Range transport shape", () => {
    // Arrange
    const invalidRange = {
      numericType: "float",
      maxBoundType: "exclusive",
      min: 1,
      max: 1,
    } as const

    // Act
    const parsedRange = RangeDto.parse(invalidRange)

    // Assert
    expect(parsedRange).toEqual(invalidRange)
  })
})
