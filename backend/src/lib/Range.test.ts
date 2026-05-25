import { describe, it, expect } from "vitest"
import { Range } from "@guillaume-docquier/tools-ts"
import { RangeDto } from "#lib/Range.ts"
import { ZodError } from "zod"

describe("Range", () => {
  describe("RangeDto", () => {
    it.each([
      Range.createMaxInclusive({
        numericType: "float",
        min: 0,
        maxInclusive: 1,
      }),
      Range.createMaxInclusive({
        numericType: "integer",
        min: 0,
        maxInclusive: 1,
        limits: Range.createMaxExclusive({ numericType: "integer", min: 0, maxExclusive: 2 }),
      }),
      Range.createMaxExclusive({
        numericType: "integer",
        min: 0,
        maxExclusive: 1,
      }),
      Range.createMaxExclusive({
        numericType: "float",
        min: 0,
        maxExclusive: 1,
        limits: Range.createMaxInclusive({ numericType: "float", min: 0, maxInclusive: 2 }),
      }),
    ])("should accept a valid range", (range) => {
      // Act
      const parsedRange = RangeDto.parse(range)

      // Assert
      expect(parsedRange).toEqual(range)
    })

    it.each([
      {
        type: "MaxInclusive",
        numericType: "float",
        min: 3,
        maxInclusive: 1,
      },
      {
        type: "MaxInclusive",
        numericType: "float",
        min: 0,
        maxInclusive: 1,
        limits: {
          type: "MaxInclusive",
          numericType: "integer",
          min: 0,
          maxInclusive: 2,
        },
      },
    ])("should refuse an invalid range", (invalidRange) => {
      // Act & Assert
      expect(() => RangeDto.parse(invalidRange)).toThrow(ZodError)
    })
  })
})
