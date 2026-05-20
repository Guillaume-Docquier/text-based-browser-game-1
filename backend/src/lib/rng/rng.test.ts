import { describe, expect, it } from "vitest"
import { mulberry32Prng } from "./mulberry32prng.ts"
import { createRng } from "#lib/rng/rng.ts"

describe("rng", () => {
  describe("float", () => {
    it("should return the generator values when no range is provided", () => {
      // Arrange
      const value = 0.5
      const rng = createRng(() => value)

      // Act
      const random = [rng.float(), rng.float(), rng.float()]

      // Assert
      expect(random).toEqual([value, value, value])
    })

    it.each([
      { value: 0, expected: 10 },
      { value: 0.35, expected: 13.5 },
      { value: 0.5, expected: 15 },
      { value: 0.65, expected: 16.5 },
      { value: 1 - Number.EPSILON, expected: 20 * (1 - Number.EPSILON) },
    ])("should return values in the range when min and max are different", ({ value, expected }) => {
      // Arrange
      const range = { min: 10, max: 20 }
      const rng = createRng(() => value)

      // Act
      const random = rng.float(range)

      // Assert
      expect(random).toEqual(expected)
    })

    it.each([0, 0.25, 0.5, 0.75, 1 - Number.EPSILON])(
      "should return exactly the min when a range is provided and min is equal to max",
      (value) => {
        // Arrange
        const range = { min: 10, max: 10 }
        const rng = createRng(() => value)

        // Act
        const random = rng.float(range)

        // Assert
        expect(random).toEqual(range.min)
      },
    )
  })

  describe("int", () => {
    it.each([
      { value: 0, expected: 10 },
      { value: 0.35, expected: 13 },
      { value: 0.5, expected: 15 },
      { value: 0.65, expected: 17 },
      { value: 1 - Number.EPSILON, expected: 20 },
    ])("should return values in the range when min and max are different", ({ value, expected }) => {
      // Arrange
      const range = { min: 10, max: 20 }
      const rng = createRng(() => value)

      // Act
      const random = rng.int(range)

      // Assert
      expect(random).toEqual(expected)
    })

    it.each([0, 0.25, 0.5, 0.75, 1 - Number.EPSILON])(
      "should return exactly the min when a range is provided and min is equal to max",
      (value) => {
        // Arrange
        const range = { min: 10, max: 10 }
        const rng = createRng(() => value)

        // Act
        const random = rng.int(range)

        // Assert
        expect(random).toEqual(range.min)
      },
    )
  })

  describe("shuffle", () => {
    it("should shuffle arrays in place", () => {
      // Arrange
      const initialValues = [1, 2, 3, 4, 5]
      const firstValues = [...initialValues]
      const firstPrng = createRng(mulberry32Prng(1234))

      // Act
      const firstResult = firstPrng.shuffle(firstValues)

      // Assert
      expect(firstValues).not.toEqual(initialValues)
      expect(firstResult).toBe(firstValues)
      expect(firstValues.toSorted((a, b) => a - b)).toEqual(initialValues)
    })
  })
})
