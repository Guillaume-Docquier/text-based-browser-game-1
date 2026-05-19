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
      { value: 0, expected: 0 },
      { value: 0.35, expected: 3.5 },
      { value: 0.5, expected: 5 },
      { value: 0.65, expected: 6.5 },
      { value: 1 - Number.EPSILON, expected: 10 * (1 - Number.EPSILON) },
    ])("should return values in the range when min and max are different", ({ value, expected }) => {
      // Arrange
      const range = { min: 0, max: 10 }
      const rng = createRng(() => value)

      // Act
      const random = rng.float(range)

      // Assert
      expect(random).toEqual(expected)
    })

    it.each([
      { value: 0, expected: 4 },
      { value: 0.5, expected: 4 },
      { value: 1 - Number.EPSILON, expected: 4 },
    ])("should return exactly the min when a range is provided and min is equal to max", ({ value, expected }) => {
      // Arrange
      const range = { min: 4, max: 4 }
      const rng = createRng(() => value)

      // Act
      const random = rng.float(range)

      // Assert
      expect(random).toEqual(expected)
    })
  })

  describe("int", () => {
    it.each([
      { value: 0, expected: 0 },
      { value: 0.35, expected: 3 },
      { value: 0.5, expected: 5 },
      { value: 0.65, expected: 7 },
      { value: 1 - Number.EPSILON, expected: 10 },
    ])("should return values in the range when min and max are different", ({ value, expected }) => {
      // Arrange
      const range = { min: 0, max: 10 }
      const rng = createRng(() => value)

      // Act
      const random = rng.int(range)

      // Assert
      expect(random).toEqual(expected)
    })

    it.each([
      { value: 0, expected: 10 },
      { value: 0.5, expected: 10 },
      { value: 1 - Number.EPSILON, expected: 10 },
    ])("should return exactly the min when a range is provided and min is equal to max", ({ value, expected }) => {
      // Arrange
      const range = { min: 10, max: 10 }
      const rng = createRng(() => value)

      // Act
      const random = rng.int(range)

      // Assert
      expect(random).toEqual(expected)
    })
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
