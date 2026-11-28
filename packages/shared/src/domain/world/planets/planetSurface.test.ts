import { assert, integer, property } from "fast-check"
import { describe, expect, it } from "vitest"
import { planetSurface } from "./planetSurface.ts"

describe("planetSurface", () => {
  it("should meet HEX-0001 When a planet surface is displayed, its area gives its exact number of usable hexes, including the center. The other hexes fill concentric rings nearest first, beginning each ring in the east and continuing clockwise, including partial rings.", () => {
    // Arrange
    const firstTwoRings = [
      [0, 0],
      [1, 0],
      [0, 1],
      [-1, 1],
      [-1, 0],
      [0, -1],
      [1, -1],
      [2, 0],
      [1, 1],
      [0, 2],
      [-1, 2],
      [-2, 2],
      [-2, 1],
      [-2, 0],
      [-1, -1],
      [0, -2],
      [1, -2],
      [2, -2],
      [2, -1],
    ]

    // Act
    const sites = planetSurface(19)

    // Assert
    expect(sites.map(({ q, r }) => [q, r])).toStrictEqual(firstTwoRings)
    assert(
      property(integer({ min: 1, max: 150 }), (area) => {
        const layout = planetSurface(area)
        expect(layout).toHaveLength(area)
        expect(layout).toStrictEqual(planetSurface(area + 1).slice(0, area))
        expect(new Set(layout.map(({ q, r }) => `${q},${r}`)).size).toBe(area)
        for (const [offset, hex] of layout.slice(1).entries()) {
          const index = offset + 1
          const ring = Math.max(Math.abs(hex.q), Math.abs(hex.r), Math.abs(hex.q + hex.r))
          const firstIndex = 1 + 3 * (ring - 1) * ring
          expect(hex.site).toBe(index)
          expect(index).toBeGreaterThanOrEqual(firstIndex)
          expect(index).toBeLessThan(1 + 3 * ring * (ring + 1))
        }
        for (let ring = 1; 1 + 3 * (ring - 1) * ring < area; ring++) {
          const site = 1 + 3 * (ring - 1) * ring
          expect(layout[site]).toStrictEqual({ site, q: ring, r: 0 })
        }
      }),
      { seed: 479, numRuns: 32 },
    )
  })
})
