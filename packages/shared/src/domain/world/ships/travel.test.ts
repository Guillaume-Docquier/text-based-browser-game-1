import { assert, integer, property } from "fast-check"
import { describe, expect, it } from "vitest"
import { SHIP_TEMPLATES } from "./Ship.ts"
import { departureSpeed, quoteTravel, traveledDistance, tripPosition, type TravelBody } from "./travel.ts"

const origin: TravelBody = { kind: "planet", id: "a", name: "A", coordinates: "00:00:01", x: 0, y: 0 }
describe("direct travel", () => {
  it("should meet TRAV-0001 When a ship departs, its speed in LY per turn is the shared scale times the square root of thrust divided by total departure mass. Total departure mass is empty ship mass plus the mass of every cargo item aboard.", () => {
    // Arrange
    const { TRANSPORT, SCOUT, COLONY_SHIP } = SHIP_TEMPLATES
    // Act & Assert
    expect([TRANSPORT, SCOUT, COLONY_SHIP].map((t) => departureSpeed(t.thrust, t.emptyMass, []))).toStrictEqual([4, 8, 4])
    expect(SCOUT.cargoSize).toBe(1)
    expect(COLONY_SHIP.cargoSize).toBe(0)
    expect(TRANSPORT.thrust).toBeGreaterThan(SCOUT.thrust)
    expect(departureSpeed(64, 4, [1, 1, 1, 1])).toBeCloseTo(Math.sqrt(8))
    expect(departureSpeed(64, 4, [1]) / 4).toBeCloseTo(Math.sqrt(4 / 5))
    expect(departureSpeed(16, 0.25, [1]) / 8).toBeCloseTo(Math.sqrt(0.25 / 1.25))
    assert(
      property(integer({ min: 1, max: 1000 }), integer({ min: 1, max: 70 }), integer({ min: 1, max: 70 }), (thrust, mass, item) => {
        const empty = departureSpeed(thrust, mass, [])
        expect(departureSpeed(thrust, mass, [mass, mass, mass])).toBeCloseTo(empty / 2, 10)
        expect(departureSpeed(thrust, mass, [item])).toBeCloseTo(Math.sqrt(thrust / (mass + item)), 12)
      }),
    )
  })

  it("should meet TRAV-0002 When a trip is planned, its duration in turns is the ceiling of direct distance in LY divided by departure speed in LY per turn, and its price is one credit per actual LY. Preview and resolution use the same distance and departure load.", () => {
    // Arrange
    const ship = { thrust: 4, emptyMass: 1 }
    const star: TravelBody = { ...origin, kind: "star", id: "b", x: 4 }
    // Act & Assert
    expect(quoteTravel(origin, star, ship, [])).toMatchObject({ distance: 4, cost: 4, speed: 2, turns: 2 })
    expect(quoteTravel(origin, { ...star, x: 4.1 }, ship, []).turns).toBe(3)
    expect(quoteTravel(origin, { ...star, x: 1 }, { thrust: 1, emptyMass: 1 }, []).turns).toBe(1)
    assert(
      property(integer({ min: 1, max: 50 }), integer({ min: 1, max: 50 }), integer({ min: 1, max: 50 }), (x, y, mass) => {
        const end = { ...star, x: x / 1e5, y: y / 1e5 }
        const distance = Math.hypot(end.x, end.y)
        const loaded = quoteTravel(origin, end, ship, [mass])
        const empty = quoteTravel(origin, end, ship, [])
        expect(loaded.distance).toBe(distance)
        expect(loaded.cost).toBe(empty.cost)
        expect(loaded.cost).toBe(distance)
        expect(loaded.turns).toBe(Math.ceil(distance / Math.sqrt(4 / (1 + mass))))
        expect(distance / loaded.speed).toBeGreaterThan(distance / empty.speed)
        expect(traveledDistance(loaded, loaded.turns)).toBe(distance)
      }),
    )
    const boundary = quoteTravel(origin, { ...star, x: 13.435028842544405 }, { thrust: 1, emptyMass: 2 }, [])
    expect(boundary.turns).toBe(19)
    expect(traveledDistance(boundary, boundary.turns)).toBe(boundary.distance)
    const route = quoteTravel({ ...origin, x: 1, y: 2 }, { ...star, x: 4, y: 6 }, ship, [])
    expect(tripPosition({ route, completedTurns: 1 })).toStrictEqual({ x: 2.2, y: 3.6 })
  })
})
