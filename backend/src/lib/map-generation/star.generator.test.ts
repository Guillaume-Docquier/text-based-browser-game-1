import { Rng, createGeneratorStub } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createSeededRng } from "#lib/createSeededRng.ts"
import { starGenerator } from "#lib/map-generation/star.generator.ts"

describe("starGenerator", () => {
  it("should generate a star at the requested position", () => {
    // Arrange
    const position = { x: 10, y: -20 }

    // Act
    const star = starGenerator(position, createSeededRng())

    // Assert
    expect(star).toStrictEqual({
      x: 10,
      y: -20,
      name: "star 74220",
    })
  })

  it("should generate deterministic stars", () => {
    // Arrange
    const position = { x: 10, y: -20 }

    // Act
    const firstStar = starGenerator(position, createSeededRng())
    const secondStar = starGenerator(position, createSeededRng())

    // Assert
    expect({ firstStar, secondStar }).toStrictEqual({
      firstStar: { x: 10, y: -20, name: "star 74220" },
      secondStar: { x: 10, y: -20, name: "star 74220" },
    })
  })

  it("should generate the minimum name suffix at the rng lower bound", () => {
    // Act
    const star = starGenerator({ x: 10, y: -20 }, Rng.create(createGeneratorStub(0)))

    // Assert
    expect(star).toStrictEqual({ x: 10, y: -20, name: "star 999" })
  })
})
