import { Assert } from "@guillaume-docquier/tools-ts"
import { integer, property, assert } from "fast-check"
import { describe, expect, it } from "vitest"
import { PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { createPlanetStub } from "./planets/Planet.stub.ts"
import { ShipIdSchema, SHIP_TEMPLATES } from "./ships/Ship.ts"
import { quoteTravel } from "./ships/travel.ts"
import { SUN_ID } from "./Sol.ts"
import { createStarStub } from "./stars/Star.stub.ts"
import { canSeeShip, inCurrentVision, locateShips, scanSources } from "./vision.ts"

describe("position scanning", () => {
  it("should meet VIS-0001 When a body or ship is at most 3 LY from an owned planet or at most 1.5 LY from the current position of an owned ship, it is in that player’s current vision. Use the union of all the player’s sources, and keep every ship’s scan radius independent of its type and cargo.", () => {
    const owner = PlayerIdSchema.parse("00000000-0000-4000-8000-000000000001")
    const guest = PlayerIdSchema.parse("00000000-0000-4000-8000-000000000002")
    const base = createPlanetStub({ id: "home", ownerPlayerId: owner, x: 0, y: 0 })
    const station = createStarStub({ id: "outpost", x: 11, y: 0 })
    const outpost = createPlanetStub({ id: "far", ownerPlayerId: guest, x: 70, y: 0 })
    const ship = { ownerPlayerId: owner, id: ShipIdSchema.parse("T-01"), planetId: null, starId: station.id, trip: null }
    assert(
      property(integer({ min: -100, max: 100 }), integer({ min: -100, max: 100 }), (x, y) => {
        const planets = [{ ...base, x, y }, outpost]
        const stars = [{ ...station, x: x + 11, y }]
        for (const template of Object.values(SHIP_TEMPLATES)) {
          for (const cargo of [[], [1]]) {
            const here = locateShips([{ ...ship, ...template, cargo }], planets, stars)
            const sources = scanSources(owner, planets, here)
            expect(inCurrentVision({ x: x + 3, y }, sources)).toBe(true)
            expect(inCurrentVision({ x: x + 3.00001, y }, sources)).toBe(false)
            expect(inCurrentVision({ x: x + 11, y: y + 1.5 }, sources)).toBe(true)
            expect(inCurrentVision({ x: x + 11, y: y + 1.50001 }, sources)).toBe(false)
            expect(inCurrentVision({ x: x + 2.2, y: y + 2.2 }, sources)).toBe(false)
            expect(inCurrentVision({ x: x + 12.1, y: y + 1.1 }, sources)).toBe(false)
            expect(scanSources(owner, planets, here)).toStrictEqual(sources)
          }
        }
      }),
    )
    const route = quoteTravel({ ...base, kind: "planet" }, { ...outpost, kind: "planet" }, SHIP_TEMPLATES.TRANSPORT, [])
    const [underway, foreign] = locateShips(
      [
        { ...ship, trip: { route, completedTurns: 2 }, starId: null },
        { ...ship, ownerPlayerId: guest, starId: null, planetId: outpost.id },
      ],
      [base, outpost],
      [station],
    )
    expect(underway?.position).toStrictEqual({ x: 8, y: 0 })
    expect(foreign?.position).toStrictEqual({ x: 70, y: 0 })
    const sources = scanSources(
      owner,
      [base, outpost],
      locateShips([{ ...ship, trip: { route, completedTurns: 2 }, starId: null }], [base, outpost], [station]),
    )
    expect(inCurrentVision({ x: 4, y: 0 }, sources)).toBe(false)
    expect(inCurrentVision({ x: 9.5, y: 0 }, sources)).toBe(true)
    const [atSun] = locateShips([{ ...ship, ownerPlayerId: guest, starId: SUN_ID }], [base], [{ ...station, id: SUN_ID }])
    Assert.isDefined(atSun)
    Assert.isDefined(foreign)
    Assert.isDefined(underway)
    const mixed = scanSources(owner, [base, outpost], [foreign, underway])
    expect(inCurrentVision(foreign.position, mixed)).toBe(false)
    expect(canSeeShip(atSun, [])).toBe(true)
    expect(canSeeShip(foreign, sources)).toBe(false)
    expect(canSeeShip(underway, sources)).toBe(true)
  })

  it("should reject an invalid stored ship location", () => {
    const ship = {
      id: ShipIdSchema.parse("T-01"),
      ownerPlayerId: PlayerIdSchema.parse("00000000-0000-4000-8000-000000000001"),
      planetId: null,
      starId: null,
      trip: null,
    }
    expect(() => locateShips([ship], [], [])).toThrow("Ship station is missing")
  })
})
