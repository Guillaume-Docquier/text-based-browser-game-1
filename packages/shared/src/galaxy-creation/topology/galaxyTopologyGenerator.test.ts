import type { Rng, XY } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { galaxyTopologyGenerator } from "#shared/galaxy-creation/topology/galaxyTopologyGenerator.ts"
import { spiralGenerator } from "#shared/galaxy-creation/topology/patterns/spiralGenerator.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"

describe("galaxyTopologyGenerator", () => {
  it("should create a square galaxy and generate systems from points", () => {
    // Act
    const galaxy = galaxyTopologyGenerator({
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
    expect(galaxy).toStrictEqual<typeof galaxy>({
      width: 10,
      height: 10,
      systems: [
        {
          star: { x: 1.25, y: 2.5 },
          planets: expect.any(Array),
        },
        {
          star: { x: 8.75, y: 9.25 },
          planets: expect.any(Array),
        },
      ],
    })
  })

  it("should remove points outside every galaxy boundary", () => {
    // Act
    const galaxy = galaxyTopologyGenerator({
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
    expect(galaxy.systems).toStrictEqual<typeof galaxy.systems>([
      {
        star: { x: 0, y: 0 },
        planets: expect.any(Array),
      },
      {
        star: { x: 9.999, y: 9.999 },
        planets: expect.any(Array),
      },
    ])
  })

  it("should keep at most one system per grid cell", () => {
    // Act
    const galaxy = galaxyTopologyGenerator({
      size: 10,
      rng: createSeededRng(),
      pointsGenerator: () => [
        { x: 1.1, y: 2.1 },
        { x: 1.9, y: 2.9 },
        { x: 2, y: 2 },
      ],
    })

    // Assert
    expect(galaxy.systems).toStrictEqual<typeof galaxy.systems>([
      {
        star: { x: 1.9, y: 2.9 },
        planets: expect.any(Array),
      },
      {
        star: { x: 2, y: 2 },
        planets: expect.any(Array),
      },
    ])
  })

  it("should generate a deterministic galaxy using the spiral generator", () => {
    // Arrange
    const size = 100
    const pointsGenerator = ({ size: galaxySize, rng }: { size: number; rng: Rng }): XY[] =>
      spiralGenerator({
        origin: { x: galaxySize / 2, y: galaxySize / 2 },
        radius: galaxySize / 2,
        nbPoints: 1_000,
        rng,
      })

    // Act
    const firstGalaxy = galaxyTopologyGenerator({ size, pointsGenerator, rng: createSeededRng() })
    const secondGalaxy = galaxyTopologyGenerator({ size, pointsGenerator, rng: createSeededRng() })

    // Assert
    expect(firstGalaxy.systems.length).toBeGreaterThan(0)
    expect(secondGalaxy).toStrictEqual(firstGalaxy)
  })

  it("should match the default realistic spiral galaxy", () => {
    // Arrange
    const size = 100
    const rng = createSeededRng(1234)

    // Act
    const galaxy = galaxyTopologyGenerator({
      size,
      pointsGenerator: () =>
        spiralGenerator({
          origin: { x: size / 2, y: size / 2 },
          radius: size / 2,
          nbPoints: 1_000,
          rng,
          options: { armCount: 6, armRadius: 12 },
        }),
      rng,
    })

    // Assert
    expect(galaxy).toMatchSnapshot()
  })
})
