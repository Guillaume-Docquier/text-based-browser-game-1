import { describe, expect, it } from "vitest"
import { createSeededRng } from "#lib/createSeededRng.ts"
import { spiralGenerator } from "#lib/map-generation/points/spiral.generator.ts"

const DEFAULT_OPTIONS = {
  origin: { x: 50, y: 50 },
  radius: 50,
  nbPoints: 1000,
  arms: { count: 6, size: 12 },
} as const

describe("spiralGenerator", () => {
  it("should generate deterministic points", () => {
    // Act
    const firstPoints = spiralGenerator({ ...DEFAULT_OPTIONS, rng: createSeededRng() })
    const secondPoints = spiralGenerator({ ...DEFAULT_OPTIONS, rng: createSeededRng() })

    // Assert
    expect(firstPoints).toEqual(secondPoints)
  })

  it("should translate the generated spiral with its origin", () => {
    // Arrange
    const origin = { x: 50, y: 50 }
    const translatedOrigin = { x: 150, y: -25 }
    const translation = {
      x: translatedOrigin.x - origin.x,
      y: translatedOrigin.y - origin.y,
    }

    // Act
    const points = spiralGenerator({ ...DEFAULT_OPTIONS, origin, rng: createSeededRng() })
    const translatedPoints = spiralGenerator({ ...DEFAULT_OPTIONS, origin: translatedOrigin, rng: createSeededRng() })

    // Assert
    expect(translatedPoints).toHaveLength(points.length)
    for (const [index, point] of points.entries()) {
      expect.soft(translatedPoints[index]?.x).toBeCloseTo(point.x + translation.x, 10)
      expect.soft(translatedPoints[index]?.y).toBeCloseTo(point.y + translation.y, 10)
    }
  })

  it("should generate roughly the requested number of points", () => {
    // Act
    const points = spiralGenerator({ ...DEFAULT_OPTIONS, rng: createSeededRng() })

    // Assert
    expect(Math.abs(points.length - DEFAULT_OPTIONS.nbPoints)).toBeLessThanOrEqual(DEFAULT_OPTIONS.nbPoints * 0.1)
  })

  it("should match the default realistic spiral", () => {
    // Act
    const points = spiralGenerator({ ...DEFAULT_OPTIONS, rng: createSeededRng(1234) })

    // Assert
    // Hard to assert that this is correct without looking at it
    // You can run `pnpm map-gen spiral --seed 1234` and the matching DEFAULT_OPTIONS to visualize the spiral
    // If you're happy, run `pnpm test:backend --update` to update the snapshot
    expect(points).toMatchSnapshot()
  })
})
