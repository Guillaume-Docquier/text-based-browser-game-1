import { Assert } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { assert, integer, property, uniqueArray, uuid } from "fast-check"
import { describe, expect, it } from "vitest"
import { PlayerIdSchema, type PlayerId } from "#shared/domain/players/PlayerId.ts"
import { createGalaxy } from "#shared/galaxy-creation/createGalaxy.ts"
import { GalaxyCreationSettings } from "#shared/galaxy-creation/GalaxyCreationSettings.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"

const galaxySeed = integer()
const playerCount = integer({ min: 1, max: 16 })

function playersFor(count: number): PlayerId[] {
  return Array.from({ length: count }, (_, i) => typedParse(PlayerIdSchema, `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`))
}
const cases = { seed: 762, numRuns: 8 }

describe("createGalaxy", () => {
  it("GC-0001 When the player list is empty, every planet in the returned galaxy is unowned.", () => {
    assert(
      property(galaxySeed, (seed) => {
        // Arrange
        const rng = createSeededRng(seed)

        // Act
        const galaxy = createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds: [], rng })

        // Assert
        expect(galaxy.systems.every(({ planets }) => planets.every(({ ownerPlayerId }) => ownerPlayerId === null))).toBe(true)
      }),
      cases,
    )
  })

  it("GC-SYS-0002 Each system in the returned galaxy occupies a distinct one-light-year grid cell.", () => {
    assert(
      property(galaxySeed, (seed) => {
        // Arrange
        const rng = createSeededRng(seed)

        // Act
        const galaxy = createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds: [], rng })

        // Assert
        const cells = galaxy.systems.map(({ star }) => `${Math.floor(star.x)},${Math.floor(star.y)}`)
        expect(new Set(cells).size).toBe(cells.length)
      }),
      cases,
    )
  })

  it("GC-PLNT-0003 When each supplied player can start in a separate system with a planet of area at least three, each player owns exactly one planet and all other planets are unowned.", () => {
    const players = uniqueArray(uuid({ version: 4 }), { minLength: 1, maxLength: 16 })
    assert(
      property(galaxySeed, players, (seed, ids) => {
        // Arrange
        const rng = createSeededRng(seed)
        const playerIds = ids.map((id) => typedParse(PlayerIdSchema, id))

        // Act
        const galaxy = createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds, rng })

        // Assert
        const owners = galaxy.systems
          .flatMap(({ planets }) => planets.map(({ ownerPlayerId }) => ownerPlayerId))
          .filter((id) => id !== null)
        expect(owners.toSorted()).toStrictEqual(playerIds.toSorted())
      }),
      cases,
    )
  })

  it("GC-SYS-0004 Each system has x and y coordinates greater than or equal to zero and less than the configured galaxy diameter.", () => {
    assert(
      property(galaxySeed, (seed) => {
        // Arrange
        const rng = createSeededRng(seed)
        const diameter = GalaxyCreationSettings.GALAXY_DIAMETER_LIGHT_YEARS

        // Act
        const galaxy = createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds: [], rng })

        // Assert
        const axes = galaxy.systems.flatMap(({ star }) => [star.x, star.y])
        expect(Math.min(...axes)).toBeGreaterThanOrEqual(0)
        expect(Math.max(...axes)).toBeLessThan(diameter)
      }),
      cases,
    )
  })

  it("GC-SYS-0005 When a match starts with 1–16 players, each player’s home planet belongs to a different system from every other player’s home planet.", () => {
    assert(
      property(galaxySeed, playerCount, (seed, count) => {
        // Arrange
        const playerIds = playersFor(count)

        // Act
        const galaxy = createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds, rng: createSeededRng(seed) })

        // Assert
        const homeSystems = galaxy.systems.filter(({ planets }) => planets.some(({ ownerPlayerId }) => ownerPlayerId !== null))
        expect(homeSystems).toHaveLength(count)
      }),
      {
        ...cases,
        examples: [
          [1234, 1],
          [1234, 16],
        ],
      },
    )
  })

  it("GC-PLNT-0006 When a player receives a home planet, its area provides at least three usable spaces including the center.", () => {
    assert(
      property(galaxySeed, playerCount, (seed, count) => {
        // Arrange
        const playerIds = playersFor(count)

        // Act
        const galaxy = createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds, rng: createSeededRng(seed) })

        // Assert
        const homes = galaxy.systems.flatMap(({ planets }) => planets.filter(({ ownerPlayerId }) => ownerPlayerId !== null))
        expect(homes).toHaveLength(count)
        expect(Math.min(...homes.map(({ area }) => area))).toBeGreaterThanOrEqual(3)
      }),
      cases,
    )
  })

  it("GC-SYS-0007 When home systems are assigned, each home occupies the nearest still-eligible system to its placement target, sampled at a uniform radius of 10–13 LY from the galaxy center and a uniform offset of −5° to +5° from its evenly spaced bearing.", () => {
    assert(
      property(galaxySeed, (seed) => {
        // Arrange
        const playerIds = playersFor(16).toReversed()
        const replay = createSeededRng(seed)
        const baseline = createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds: [], rng: replay })
        const eligibleSystems = new Set(baseline.systems.filter(({ planets }) => planets.some(({ area }) => area >= 3)))
        const center = GalaxyCreationSettings.GALAXY_DIAMETER_LIGHT_YEARS / 2

        // Act
        const galaxy = createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds, rng: createSeededRng(seed) })

        // Assert
        for (const [index, playerId] of replay.shuffle(playerIds.toSorted()).entries()) {
          const offsetDegrees = -5 + 10 * replay.float()
          const radians = (index * 2 * Math.PI) / playerIds.length + (offsetDegrees * Math.PI) / 180
          const radius = 10 + 3 * replay.float()
          const x = center + Math.cos(radians) * radius
          const y = center + Math.sin(radians) * radius
          const actual = galaxy.systems.find(({ planets }) => planets.some(({ ownerPlayerId }) => ownerPlayerId === playerId))
          Assert.isDefined(actual)
          const matchingSystem = baseline.systems.find(({ star }) => star.id === actual.star.id)
          Assert.isDefined(matchingSystem)
          expect(eligibleSystems.has(matchingSystem)).toBe(true)
          const distances = Array.from(eligibleSystems, ({ star }) => Math.hypot(star.x - x, star.y - y))
          expect(Math.hypot(actual.star.x - x, actual.star.y - y)).toBe(Math.min(...distances))
          eligibleSystems.delete(matchingSystem)
          replay.draw(
            matchingSystem.planets.filter(({ area }) => area >= 3),
            1,
          )
        }
      }),
      { ...cases, examples: [[5], [49]] },
    )
  })

  it("GC-0008 With the default match settings, the returned procedural galaxy contains approximately 700 star systems and 3,000 planets.", () => {
    assert(
      property(galaxySeed, (seed) => {
        // Arrange
        const seeds = [123, 1234, seed]

        // Act
        const galaxies = seeds.map((mapSeed) =>
          createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds: [], rng: createSeededRng(mapSeed) }),
        )

        // Assert
        const meanSystemCount = galaxies.reduce((total, galaxy) => total + galaxy.systems.length, 0) / galaxies.length
        const planetCounts = galaxies.map(({ systems }) => systems.reduce((total, system) => total + system.planets.length, 0))
        const meanPlanetCount = planetCounts.reduce((total, count) => total + count, 0) / galaxies.length
        expect(meanSystemCount).toBeGreaterThanOrEqual(525)
        expect(meanSystemCount).toBeLessThanOrEqual(875)
        expect(meanPlanetCount).toBeGreaterThanOrEqual(2250)
        expect(meanPlanetCount).toBeLessThanOrEqual(3750)
      }),
      cases,
    )
  })
})
