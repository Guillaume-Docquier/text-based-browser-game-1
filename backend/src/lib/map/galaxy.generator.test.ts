import { createRng, mulberry32Prng, type Rng } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { galaxyGenerator } from "#lib/map/galaxy.generator.ts"
import type { Point2D } from "#lib/map/points/Point2D.ts"
import { spiralGenerator } from "#lib/map/points/spiral.generator.ts"

describe("galaxyGenerator", () => {
  function createSeededRng(seed = 1234): Rng {
    return createRng(mulberry32Prng(seed))
  }

  it("should create a square galaxy and generate systems from points", () => {
    // Act
    const galaxy = galaxyGenerator({
      size: 10,
      rng: createSeededRng(),
      pointsGenerator: ({ size }) => {
        expect(size).toBe(10)
        return [
          { x: 1.25, y: 2.5 },
          { x: 8.75, y: 9.25 },
        ]
      },
    })

    // Assert
    expect(galaxy).toEqual({
      width: 10,
      height: 10,
      systems: [
        {
          star: { x: 1.25, y: 2.5 },
          planets: [],
        },
        {
          star: { x: 8.75, y: 9.25 },
          planets: [],
        },
      ],
    })
  })

  it("should remove points outside every galaxy boundary", () => {
    // Act
    const galaxy = galaxyGenerator({
      size: 10,
      rng: createSeededRng(),
      pointsGenerator: () => [
        { x: 0, y: 0 },
        { x: 9.999, y: 9.999 },
        { x: -0.001, y: 5 },
        { x: 10, y: 5 },
        { x: 5, y: -0.001 },
        { x: 5, y: 10 },
      ],
    })

    // Assert
    expect(galaxy.systems).toEqual([
      {
        star: { x: 0, y: 0 },
        planets: [],
      },
      {
        star: { x: 9.999, y: 9.999 },
        planets: [],
      },
    ])
  })

  it("should keep at most one system per grid cell", () => {
    // Act
    const galaxy = galaxyGenerator({
      size: 10,
      rng: createSeededRng(),
      pointsGenerator: () => [
        { x: 1.1, y: 2.1 },
        { x: 1.9, y: 2.9 },
        { x: 2, y: 2 },
      ],
    })

    // Assert
    expect(galaxy.systems).toEqual([
      {
        star: { x: 1.9, y: 2.9 },
        planets: [],
      },
      {
        star: { x: 2, y: 2 },
        planets: [],
      },
    ])
  })

  it("should generate a deterministic galaxy using the spiral generator", () => {
    // Arrange
    const size = 100
    const pointsGenerator = ({ size: galaxySize, rng }: { size: number; rng: Rng }): Point2D[] =>
      spiralGenerator({
        origin: { x: galaxySize / 2, y: galaxySize / 2 },
        radius: galaxySize / 2,
        nbPoints: 1_000,
        arms: { count: 6, size: 15 },
        rng,
      })

    // Act
    const firstGalaxy = galaxyGenerator({ size, pointsGenerator, rng: createSeededRng() })
    const secondGalaxy = galaxyGenerator({ size, pointsGenerator, rng: createSeededRng() })

    // Assert
    expect(firstGalaxy.systems.length).toBeGreaterThan(0)
    expect(secondGalaxy).toEqual(firstGalaxy)
  })

  it("should match the default realistic spiral galaxy", () => {
    // Arrange
    const size = 100
    const rng = createSeededRng(1234)

    // Act
    const galaxy = galaxyGenerator({
      size,
      pointsGenerator: () =>
        spiralGenerator({
          origin: { x: size / 2, y: size / 2 },
          radius: size / 2,
          nbPoints: 1_000,
          arms: { count: 6, size: 15 },
          rng,
        }),
      rng,
    })

    // Assert
    // Hard to assert that this is correct without looking at it
    // You can run `pnpm map-gen spiral --seed 1234` and the matching DEFAULT_OPTIONS to visualize the spiral
    expect(galaxy).toMatchSnapshot()
  })
})
