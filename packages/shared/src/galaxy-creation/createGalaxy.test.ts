import { Assert, createGeneratorStub, Distance, Rng, UnitOfDistance } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { assert, integer, property, uniqueArray, uuid } from "fast-check"
import { describe, expect, it } from "vitest"
import { PlayerIdSchema, type PlayerId } from "#shared/domain/players/PlayerId.ts"
import { createGalaxyStub } from "#shared/domain/world/Galaxy.stub.ts"
import type { Galaxy } from "#shared/domain/world/Galaxy.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import type { Planet } from "#shared/domain/world/planets/Planet.ts"
import { PlanetBiome } from "#shared/domain/world/planets/PlanetBiome.ts"
import { SUN_ID } from "#shared/domain/world/Sol.ts"
import type { Star } from "#shared/domain/world/stars/Star.ts"
import { createStarSystemStub } from "#shared/domain/world/StarSystem.stub.ts"
import { generateGalaxyAttributes } from "#shared/galaxy-creation/attributes/generateGalaxyAttributes.ts"
import { createGalaxy } from "#shared/galaxy-creation/createGalaxy.ts"
import { GalaxyCreationSettings } from "#shared/galaxy-creation/GalaxyCreationSettings.ts"
import { generateMetalDeposits } from "#shared/galaxy-creation/generateMetalDeposits.ts"
import { generateSolSystem } from "#shared/galaxy-creation/generateSolSystem.ts"
import { generateHomePlanets } from "#shared/galaxy-creation/home-planets/generateHomePlanets.ts"
import { galaxyTopologyGenerator } from "#shared/galaxy-creation/topology/galaxyTopologyGenerator.ts"
import { spiralGenerator } from "#shared/galaxy-creation/topology/patterns/spiralGenerator.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"

const galaxySeed = integer()
const playerCount = integer({ min: 1, max: 16 })

function playersFor(count: number): PlayerId[] {
  return Array.from({ length: count }, (_, i) => typedParse(PlayerIdSchema, `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`))
}
const cases = { seed: 762, numRuns: 8 }

function replayOrdinaryGalaxy(replay: Rng): Galaxy {
  const size = GalaxyCreationSettings.GALAXY_DIAMETER_LIGHT_YEARS
  const center = size / 2
  const topology = galaxyTopologyGenerator({
    size,
    rng: replay,
    pointsGenerator: () =>
      spiralGenerator({
        origin: { x: center, y: center },
        radius: center,
        nbPoints: GalaxyCreationSettings.GALAXY_SYSTEMS_COUNT,
        rng: replay,
      }),
  })
  return generateGalaxyAttributes({ galaxyTopology: topology, rng: replay })
}

function replayBeforeHomeAssignment(rng: Rng): { galaxy: Galaxy; sun: Star } {
  const ordinary = replayOrdinaryGalaxy(rng)
  const sol = generateSolSystem(ordinary.systems, GalaxyCreationSettings.GALAXY_DIAMETER_LIGHT_YEARS / 2, rng)
  const systems = ordinary.systems.map((system) => (system.star.coordinates === sol.star.coordinates ? sol : system))
  return { galaxy: { systems }, sun: sol.star }
}

function checkDepositRolls(seed: number, metallic: boolean): void {
  // Arrange
  const playerIds = playersFor(16)
  const replay = createSeededRng(seed)
  const { galaxy, sun } = replayBeforeHomeAssignment(replay)
  const settled = generateHomePlanets({ galaxy, sun, galaxyCreationSettings: GalaxyCreationSettings, playerIds, rng: replay })

  // Act
  const result = createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds, rng: createSeededRng(seed) })

  // Assert
  const expected = new Map<string, readonly number[]>()
  for (const system of settled.systems) {
    if (system.star.id === SUN_ID || system.planets.some((p) => p.ownerPlayerId !== null)) {
      continue
    }
    for (const planet of system.planets) {
      if (planet.biome === PlanetBiome.GAS) {
        continue
      }
      const isMetallic = planet.biome === PlanetBiome.METALLIC
      const present = replay.float() < (isMetallic ? 0.75 : 0.25)
      const amount = present ? (isMetallic ? 10 : 5) + Math.floor(replay.float() * 11) : 0
      const rate = present ? (isMetallic ? 2 : 1) + Math.floor(replay.float() * 3) : 0
      if (isMetallic === metallic) {
        expected.set(planet.id, [amount, rate])
      }
    }
  }
  const checked = result.systems.flatMap((system) => system.planets).filter((planet) => expected.has(planet.id))
  expect(checked.length).toBeGreaterThan(0)
  expect(checked.map((planet) => [planet.remainingMetalDeposit, planet.metalProduction])).toStrictEqual(
    checked.map((planet) => expected.get(planet.id)),
  )
}

function checkDepositBoundary(biome: PlanetBiome, chance: number): void {
  // Arrange
  const planet = createPlanetStub({ biome })
  const galaxy = createGalaxyStub({ systems: [createStarSystemStub({ planets: [planet] })] })
  const rng = Rng.create(createGeneratorStub(chance))

  // Act
  const result = generateMetalDeposits(galaxy, rng)

  // Assert
  expect(result.systems[0]?.planets).toStrictEqual([planet])
}

function hasZeroMetal(planet: Planet): boolean {
  return planet.metalProduction === 0 && planet.remainingMetalDeposit === 0
}

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

  it("GC-SYS-0007 When home systems are assigned, each home occupies the nearest still-eligible non-Sol system to its placement target, sampled at a uniform radius of 10–13 LY from the Sun and a uniform offset of −5° to +5° from its evenly spaced bearing.", () => {
    assert(
      property(galaxySeed, (seed) => {
        // Arrange
        const playerIds = playersFor(16).toReversed()
        const replay = createSeededRng(seed)
        const { galaxy: baseline, sun } = replayBeforeHomeAssignment(replay)
        const eligibleSystems = new Set(
          baseline.systems.filter(({ star }) => star.id !== SUN_ID).filter(({ planets }) => planets.some(({ area }) => area >= 3)),
        )

        // Act
        const galaxy = createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds, rng: createSeededRng(seed) })

        // Assert
        for (const [index, playerId] of replay.shuffle(playerIds.toSorted()).entries()) {
          const offsetDegrees = -5 + 10 * replay.float()
          const radians = (index * 2 * Math.PI) / playerIds.length + (offsetDegrees * Math.PI) / 180
          const radius = 10 + 3 * replay.float()
          const x = sun.x + Math.cos(radians) * radius
          const y = sun.y + Math.sin(radians) * radius
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
      { ...cases, examples: [[42], [43]] },
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

  it("GC-SYS-0009 When a prototype galaxy is generated, it contains exactly one Sol system, selected with seeded randomness from systems within 5 LY of the galaxy center and replacing the selected system at its original position.", () => {
    assert(
      property(galaxySeed, (seed) => {
        // Arrange
        const replay = createSeededRng(seed)
        const center = GalaxyCreationSettings.GALAXY_DIAMETER_LIGHT_YEARS / 2
        const ordinary = replayOrdinaryGalaxy(replay)
        const candidates = ordinary.systems.filter(({ star }) => Math.hypot(star.x - center, star.y - center) <= 5)
        const expected = candidates[Math.floor(replay.float() * candidates.length)]
        Assert.isDefined(expected)

        // Act
        const galaxy = createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds: [], rng: createSeededRng(seed) })

        // Assert
        const suns = galaxy.systems.filter(({ star }) => star.name === "Sun")
        expect(suns).toHaveLength(1)
        expect(suns[0]?.star).toStrictEqual({ ...expected.star, name: "Sun", id: SUN_ID })
        expect(galaxy.systems).toHaveLength(ordinary.systems.length)
        expect(galaxy.systems.map(({ star }) => star.coordinates)).toStrictEqual(ordinary.systems.map(({ star }) => star.coordinates))
      }),
      cases,
    )
  })

  it("GC-PLNT-0010 In order of increasing distance from the Sun, Sol contains Mercury (small metallic, 0.387 AU), Venus (small volcanic, 0.723 AU), Earth (small oceanic, 1.000 AU), Mars (small volcanic, 1.524 AU), Jupiter (large gas, 5.203 AU), Saturn (large gas, 9.537 AU), Uranus (medium icy, 19.191 AU) and Neptune (medium icy, 30.069 AU) on circular orbits.", () => {
    assert(
      property(galaxySeed, (seed) => {
        // Arrange
        const rng = createSeededRng(seed)

        // Act
        const galaxy = createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds: [], rng })

        // Assert
        const sol = galaxy.systems.find(({ star }) => star.name === "Sun")
        Assert.isDefined(sol)
        const planets = sol.planets.map((planet) => {
          const distanceLY = Math.hypot(planet.x - sol.star.x, planet.y - sol.star.y)
          const orbitAU = Distance.in(Distance.create(distanceLY, UnitOfDistance.LIGHT_YEARS), UnitOfDistance.ASTRONOMICAL_UNITS)
          return [planet.name, planet.size, planet.biome, Number(orbitAU.toFixed(3))]
        })
        expect(planets).toStrictEqual([
          ["Mercury", "SMALL", "METALLIC", 0.387],
          ["Venus", "SMALL", "VOLCANIC", 0.723],
          ["Earth", "SMALL", "OCEANIC", 1],
          ["Mars", "SMALL", "VOLCANIC", 1.524],
          ["Jupiter", "LARGE", "GAS", 5.203],
          ["Saturn", "LARGE", "GAS", 9.537],
          ["Uranus", "MEDIUM", "FROZEN", 19.191],
          ["Neptune", "MEDIUM", "FROZEN", 30.069],
        ])
      }),
      cases,
    )
  })

  it("GC-0011 When a galaxy is generated, every star and planet has a distinct public coordinate that identifies that body throughout the match.", () => {
    assert(
      property(galaxySeed, (seed) => {
        // Arrange
        const rng = createSeededRng(seed)

        // Act
        const galaxy = createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds: playersFor(1), rng })

        // Assert
        const bodies = galaxy.systems.flatMap(({ star, planets }) => [star, ...planets])
        expect(new Set(bodies.map((body) => body.coordinates)).size).toBe(bodies.length)
        expect(new Set(bodies.map((body) => body.id)).size).toBe(bodies.length)
        const expectedAddresses = galaxy.systems.flatMap(({ star, planets }) => {
          const row = Math.floor(star.y)
          const column = Math.floor(star.x)
          const starAddress = `${Math.floor(row / 10)}${Math.floor(column / 10)}:${row % 10}${column % 10}`
          return [
            starAddress,
            ...planets.map((planet) => {
              const distanceLY = Math.hypot(planet.x - star.x, planet.y - star.y)
              const distanceAU = Distance.in(Distance.create(distanceLY, UnitOfDistance.LIGHT_YEARS), UnitOfDistance.ASTRONOMICAL_UNITS)
              return `${starAddress}:${Number(distanceAU.toFixed(3)).toString().padStart(2, "0")}`
            }),
          ]
        })
        expect(bodies.map((body) => body.coordinates)).toStrictEqual(expectedAddresses)
      }),
      cases,
    )
  })
})

describe("createGalaxy metal deposits", () => {
  it("GC-PLNT-0012 When a galaxy is generated, each planet retains its biome, size and area and has separate integer values for metal production and remaining metal deposit.", () => {
    assert(
      property(galaxySeed, (seed) => {
        // Arrange
        const rng = createSeededRng(seed)
        const before = replayBeforeHomeAssignment(createSeededRng(seed)).galaxy

        // Act
        const result = createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds: playersFor(2), rng })

        // Assert
        const planets = result.systems.flatMap((s) => s.planets)
        const attributes = (planet: Planet): readonly [Planet["id"], Planet["biome"], Planet["size"], number] => [
          planet.id,
          planet.biome,
          planet.size,
          planet.area,
        ]
        expect(planets.map(attributes)).toStrictEqual(before.systems.flatMap((s) => s.planets.map(attributes)))
        expect(planets.every((p) => Number.isInteger(p.metalProduction))).toBe(true)
        expect(planets.every((p) => Number.isInteger(p.remainingMetalDeposit))).toBe(true)
      }),
      cases,
    )
  })

  it("GC-PLNT-0013 When a planet is in Sol or any player’s starting home system, its metal production and remaining metal deposit both start at zero.", () => {
    assert(
      property(galaxySeed, playerCount, (seed, count) => {
        // Arrange
        const playerIds = playersFor(count)
        // Act
        const result = createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds, rng: createSeededRng(seed) })
        // Assert
        const homes = result.systems.filter((system) => system.planets.some((planet) => planet.ownerPlayerId !== null))
        expect(homes).toHaveLength(count)
        const sol = result.systems.find(({ star }) => star.id === SUN_ID)
        Assert.isDefined(sol)
        expect([sol, ...homes].every((system) => system.planets.every(hasZeroMetal))).toBe(true)
      }),
      { ...cases, examples: [[1234, 16]] },
    )
  })

  it("GC-PLNT-0014 When a planet outside those systems is gas, its metal production and remaining metal deposit both start at zero.", () => {
    assert(
      property(galaxySeed, (seed) => {
        // Arrange
        const rng = createSeededRng(seed)
        // Act
        const result = createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds: [], rng })
        // Assert
        const gas = result.systems
          .filter(({ star }) => star.id !== SUN_ID)
          .flatMap((s) => s.planets)
          .filter((p) => p.biome === PlanetBiome.GAS)
        expect(gas.length).toBeGreaterThan(0)
        expect(gas.every(hasZeroMetal)).toBe(true)
      }),
      cases,
    )
  })

  it("GC-PLNT-0015 When a metallic planet outside those systems is generated, it has a 75% chance of a deposit. On a successful roll its remaining deposit is a uniform integer from 10 to 20 and its production is an independently sampled uniform integer from 2 to 4. Otherwise both values are zero.", () => {
    assert(
      property(galaxySeed, (seed) => {
        checkDepositRolls(seed, true)
      }),
      cases,
    )
    checkDepositBoundary(PlanetBiome.METALLIC, 0.75)
  })

  it("GC-PLNT-0016 When a planet of any other non-gas biome outside those systems is generated, it has a 25% chance of a deposit. On a successful roll its remaining deposit is a uniform integer from 5 to 15 and its production is an independently sampled uniform integer from 1 to 3. Otherwise both values are zero.", () => {
    assert(
      property(galaxySeed, (seed) => {
        checkDepositRolls(seed, false)
      }),
      cases,
    )
    checkDepositBoundary(PlanetBiome.OCEANIC, 0.25)
  })
})
