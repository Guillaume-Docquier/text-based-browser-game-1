import { createRng, mulberry32Prng, type Rng } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { clusterGenerator } from "#lib/map-generation/points/cluster.generator.ts"

describe("clusterGenerator", () => {
  function createSeededRng(): Rng {
    return createRng(mulberry32Prng(1234))
  }

  it("should generate the requested number of points", () => {
    // Arrange
    const nbPoints = 5

    // Act
    const points = clusterGenerator({
      origin: { x: 10, y: -20 },
      radius: 8,
      nbPoints,
      rng: createSeededRng(),
    })

    // Assert
    expect(points).toHaveLength(nbPoints)
  })

  it("should generate deterministic points around the requested origin", () => {
    // Act
    const points = clusterGenerator({
      origin: { x: 10, y: -20 },
      radius: 8,
      nbPoints: 3,
      rng: createSeededRng(),
    })

    // Assert
    expect(points).toEqual([
      { x: 5.622176817322515, y: -21.319382299011856 },
      { x: 9.833640711187641, y: -19.111258152436452 },
      { x: 13.408752794522321, y: -16.266248239075466 },
    ])
  })

  it("should translate the generated cluster with its origin", () => {
    // Arrange
    const origin = { x: 10, y: -20 }
    const translatedOrigin = { x: 110, y: -95 }
    const translation = {
      x: translatedOrigin.x - origin.x,
      y: translatedOrigin.y - origin.y,
    }

    // Act
    const points = clusterGenerator({ origin, radius: 8, nbPoints: 5, rng: createSeededRng() })
    const translatedPoints = clusterGenerator({ origin: translatedOrigin, radius: 8, nbPoints: 5, rng: createSeededRng() })

    // Assert
    expect(translatedPoints).toHaveLength(points.length)
    for (const [index, point] of points.entries()) {
      expect.soft(translatedPoints[index]?.x).toBeCloseTo(point.x + translation.x, 10)
      expect.soft(translatedPoints[index]?.y).toBeCloseTo(point.y + translation.y, 10)
    }
  })

  it("should generate points following a normal distribution around the origin", () => {
    // Arrange
    const origin = { x: 100, y: -50 }
    const radius = 40
    const standardDeviation = radius / 4
    const nbPoints = 10_000
    const expectedOneStandardDeviationCoverage = 0.6827
    const expectedTwoStandardDeviationCoverage = 0.9545

    // Act
    const points = clusterGenerator({ origin, radius, nbPoints, rng: createSeededRng() })

    // Assert
    for (const axis of ["x", "y"] as const) {
      const values = points.map((point) => point[axis])
      const actualMean = values.reduce((sum, value) => sum + value, 0) / nbPoints
      const actualStandardDeviation = Math.sqrt(values.reduce((sum, value) => sum + (value - actualMean) ** 2, 0) / nbPoints)
      const actualOneStandardDeviationCoverage =
        values.filter((value) => Math.abs(value - origin[axis]) <= standardDeviation).length / nbPoints
      const actualTwoStandardDeviationCoverage =
        values.filter((value) => Math.abs(value - origin[axis]) <= 2 * standardDeviation).length / nbPoints

      expect.soft(actualMean).toBeCloseTo(origin[axis], 1)
      expect.soft(actualStandardDeviation).toBeCloseTo(standardDeviation, 1)
      expect.soft(actualOneStandardDeviationCoverage).toBeCloseTo(expectedOneStandardDeviationCoverage, 2)
      expect.soft(actualTwoStandardDeviationCoverage).toBeCloseTo(expectedTwoStandardDeviationCoverage, 2)
    }
  })

  it("should generate no points when the requested amount is zero", () => {
    // Act
    const points = clusterGenerator({
      origin: { x: 10, y: -20 },
      radius: 8,
      nbPoints: 0,
      rng: createSeededRng(),
    })

    // Assert
    expect(points).toEqual([])
  })
})
