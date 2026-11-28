import { describe, expect, it } from "vitest"
import { createStarStub } from "#shared/domain/world/stars/Star.stub.ts"
import { createStarSystemStub } from "#shared/domain/world/StarSystem.stub.ts"
import { generateSolSystem } from "#shared/galaxy-creation/generateSolSystem.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"

describe("generateSolSystem", () => {
  it("should draw from the center and the inclusive five-light-year boundary", () => {
    // Arrange
    const candidates = [0, 5, 5.0001].map((x) => createStarSystemStub({ star: createStarStub({ x, y: 0 }) }))

    // Act
    const positions = Array.from({ length: 32 }, (_, seed) => generateSolSystem(candidates, 0, createSeededRng(seed)).star.x)

    // Assert
    expect(new Set(positions)).toStrictEqual(new Set([0, 5]))
  })

  it("should require a candidate within the permitted distance", () => {
    // Arrange
    const systems = [createStarSystemStub({ star: createStarStub({ x: 4, y: 4 }) })]

    // Act & Assert
    expect(() => generateSolSystem(systems, 0, createSeededRng())).toThrow("Expected condition to be true.")
  })
})
