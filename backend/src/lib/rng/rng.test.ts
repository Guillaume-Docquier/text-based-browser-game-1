import { describe, expect, it } from "vitest"
import { mulberry32Prng } from "./mulberry32prng.ts"
import { createRng } from "#lib/rng/rng.ts"
import { byAscending } from "#lib/byAscending.ts"

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
      // Floats bigger than 1
      { value: 0, expected: 10, min: 10, max: 20 },
      { value: 0.35, expected: 13.5, min: 10, max: 20 },
      { value: 0.5, expected: 15, min: 10, max: 20 },
      { value: 0.65, expected: 16.5, min: 10, max: 20 },
      { value: 1 - Number.EPSILON, expected: 20, min: 10, max: 20 }, // An example where float range is inclusive because of floating point errors
      // Floats smaller than 1
      { value: 0, expected: 0.3, min: 0.3, max: 0.7 },
      { value: 0.35, expected: 0.43999999999999995, min: 0.3, max: 0.7 },
      { value: 0.5, expected: 0.5, min: 0.3, max: 0.7 },
      { value: 0.65, expected: 0.56, min: 0.3, max: 0.7 },
      { value: 1 - Number.EPSILON, expected: 0.6999999999999998, min: 0.3, max: 0.7 },
    ])("should return values in the range when min and max are different", ({ value, expected, min, max }) => {
      // Arrange
      const range = { min, max }
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
      const arrayToShuffle = initialValues.slice()
      const rng = createRng(mulberry32Prng(1234))

      // Act
      const shuffled = rng.shuffle(arrayToShuffle)

      // Assert
      expect(arrayToShuffle).not.toEqual(initialValues)
      expect(shuffled).toBe(arrayToShuffle)
      expect(arrayToShuffle.toSorted(byAscending)).toEqual(initialValues)
    })
  })

  describe("draw", () => {
    it("should not modify the original array", () => {
      // Arrange
      const values = [1, 2, 3, 4, 5]
      const valuesCopy = values.slice()
      const rng = createRng(mulberry32Prng(1234))

      // Act
      const { drawn, remaining } = rng.draw(values, 3)

      // Assert
      expect.soft(values).toEqual(valuesCopy)
      expect.soft(drawn).not.toBe(values)
      expect.soft(remaining).not.toBe(values)
    })

    it("should randomly draw the requested amount", () => {
      // Arrange
      const values = [1, 2, 3, 4, 5]
      const rng = createRng(mulberry32Prng(1234))

      // Act
      const { drawn, remaining } = rng.draw(values, 3)

      // Assert
      expect.soft(drawn).toEqual([4, 3, 1])
      expect.soft(remaining).toEqual([5, 2])
    })

    it("should be deterministic given the same seed", () => {
      // Arrange
      const values = [1, 2, 3, 4, 5]
      const drawCount = 3
      const rng1 = createRng(mulberry32Prng(1234))
      const rng2 = createRng(mulberry32Prng(1234))

      // Act
      const draw1 = rng1.draw(values, drawCount)
      const draw2 = rng2.draw(values, drawCount)

      // Assert
      expect(draw1).toEqual(draw2)
    })
  })
})
