import { Rng, createGeneratorStub } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { starTopologyGenerator } from "#shared/galaxy-creation/topology/starTopologyGenerator.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"

describe("starTopologyGenerator", () => {
  it("should generate a star at the requested position", () => {
    // Arrange
    const position = { x: 10, y: -20 }

    // Act
    const star = starTopologyGenerator(position, createSeededRng())

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
    const firstStar = starTopologyGenerator(position, createSeededRng())
    const secondStar = starTopologyGenerator(position, createSeededRng())

    // Assert
    expect({ firstStar, secondStar }).toStrictEqual({
      firstStar: { x: 10, y: -20, name: "star 74220" },
      secondStar: { x: 10, y: -20, name: "star 74220" },
    })
  })

  it("should generate the minimum name suffix at the rng lower bound", () => {
    // Act
    const star = starTopologyGenerator({ x: 10, y: -20 }, Rng.create(createGeneratorStub(0)))

    // Assert
    expect(star).toStrictEqual({ x: 10, y: -20, name: "star 999" })
  })
})
