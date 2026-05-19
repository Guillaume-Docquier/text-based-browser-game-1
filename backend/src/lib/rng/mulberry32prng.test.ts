import { describe, expect, it } from "vitest"
import { mulberry32Prng } from "./mulberry32prng.ts"

describe("mulberry32Prng", () => {
  it("should return identical float sequences for the same seed", () => {
    // Arrange
    const seed = 1234
    const firstPrng = mulberry32Prng(seed)
    const secondPrng = mulberry32Prng(seed)

    // Act
    const firstSequence = [firstPrng(), firstPrng(), firstPrng()]
    const secondSequence = [secondPrng(), secondPrng(), secondPrng()]

    // Assert
    expect(firstSequence).toEqual(secondSequence)
  })

  it("should return different float sequences for different seeds", () => {
    // Arrange
    const firstPrng = mulberry32Prng(1)
    const secondPrng = mulberry32Prng(2)

    // Act
    const firstSequence = [firstPrng(), firstPrng(), firstPrng()]
    const secondSequence = [secondPrng(), secondPrng(), secondPrng()]

    // Assert
    expect(firstSequence).not.toEqual(secondSequence)
  })

  it("should return default floats in the range [0, 1)", () => {
    // Arrange
    const prng = mulberry32Prng(1234)

    // Act
    const values = Array.from({ length: 100_000 }, () => prng())

    // Assert
    expect.soft(Math.min(...values)).toBeGreaterThanOrEqual(0)
    expect.soft(Math.max(...values)).toBeLessThan(1)
  })
})
