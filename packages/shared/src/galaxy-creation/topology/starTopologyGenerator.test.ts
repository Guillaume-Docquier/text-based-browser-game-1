import { describe, expect, it } from "vitest"
import { starTopologyGenerator } from "#shared/galaxy-creation/topology/starTopologyGenerator.ts"

describe("starTopologyGenerator", () => {
  it("should generate a star at the requested position", () => {
    // Arrange
    const position = { x: 10, y: -20 }

    // Act
    const star = starTopologyGenerator(position)

    // Assert
    expect(star).toStrictEqual({
      x: 10,
      y: -20,
    })
  })
})
