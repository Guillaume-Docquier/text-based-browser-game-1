import { Assert } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { assert, integer, property, uuid } from "fast-check"
import { describe, expect, it } from "vitest"
import { GameIdSchema } from "#shared/domain/games/GameId.ts"
import { PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { BuildingType } from "#shared/domain/world/buildings/Building.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import { ShipIdSchema } from "#shared/domain/world/ships/Ship.ts"
import { quoteTravel, type TravelBody } from "#shared/domain/world/ships/travel.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"
import type { TurnState } from "#shared/turn-resolution/TurnState.ts"

describe("resolveTurn", () => {
  it("TR-0001 When a turn has no eligible automatic effects, trips in progress or submitted orders, resolving it preserves the supplied game state.", () => {
    assert(
      property(integer({ min: 1, max: 100 }), uuid({ version: 4 }), uuid({ version: 4 }), (turn, playerId, planetId) => {
        // Arrange
        const state: TurnState = {
          gameId: typedParse(GameIdSchema, 1),
          turn,
          players: [{ id: typedParse(PlayerIdSchema, playerId) }],
          shipMoves: [],
          constructionOrders: [],
          buildings: [],
          planets: [createPlanetStub({ id: planetId, ownerPlayerId: playerId })],
        }
        const before = structuredClone(state)

        // Act
        const result = resolveTurn(state, createSeededRng())

        // Assert
        expect(state).toStrictEqual(before)
        expect(result.creditChanges.size).toBe(0)
      }),
    )
  })

  it("TR-0002 Resolving an empty turn preserves the random generator state.", () => {
    assert(
      property(integer(), (seed) => {
        // Arrange
        const state: TurnState = {
          gameId: typedParse(GameIdSchema, 1),
          turn: 1,
          players: [],
          planets: [],
          shipMoves: [],
          constructionOrders: [],
          buildings: [],
        }
        const rng = createSeededRng(seed)
        const before = rng.getState()

        // Act
        resolveTurn(state, rng)

        // Assert
        expect(rng.getState()).toStrictEqual(before)
      }),
    )
  })

  it("TR-0003 When a turn resolves, each trade center present at turn start earns 10 credits for its planet’s owner, added once to that player’s global credit balance.", () => {
    assert(
      property(integer({ min: 1, max: 16 }), integer({ min: 1, max: 16 }), integer(), (extraCenters, otherCenters, seed) => {
        // Arrange
        const first = typedParse(PlayerIdSchema, "9985190a-8097-4981-a5df-a83e06acbd53")
        const second = typedParse(PlayerIdSchema, "41139bae-1ebb-4022-a9b5-e8841bd5ab23")
        const home = createPlanetStub({ id: "home", ownerPlayerId: first })
        const colony = createPlanetStub({ id: "colony", ownerPlayerId: first })
        const other = createPlanetStub({ id: "other", ownerPlayerId: second })
        const unowned = createPlanetStub({ id: "unowned" })
        const state: TurnState = {
          gameId: typedParse(GameIdSchema, 1),
          turn: 3,
          players: [{ id: first }, { id: second }],
          planets: [other, unowned, home, colony],
          shipMoves: [],
          constructionOrders: [],
          buildings: [
            { type: BuildingType.TRADE_CENTER, planetId: home.id },
            { type: BuildingType.COMMAND_CENTER, planetId: home.id },
            { type: BuildingType.TRADE_CENTER, planetId: unowned.id },
            ...Array.from({ length: extraCenters }, () => ({ type: BuildingType.TRADE_CENTER, planetId: colony.id })),
            ...Array.from({ length: otherCenters }, () => ({ type: BuildingType.TRADE_CENTER, planetId: other.id })),
          ],
        }
        const snapshot = structuredClone(state)

        // Act
        const result = resolveTurn(state, createSeededRng(seed))
        const replay = resolveTurn({ ...snapshot, buildings: snapshot.buildings.toReversed() }, createSeededRng(seed))

        // Assert
        expect(result.creditChanges).toStrictEqual(
          new Map([
            [first, String(10 * (1 + extraCenters))],
            [second, String(10 * otherCenters)],
          ]),
        )
        expect(replay).toStrictEqual(result)
        expect(state).toStrictEqual(snapshot)
      }),
    )
  })

  it("TR-0005 When the turn resolves, construct each still-submitted building once at its chosen hex and charge its owner once. It first provides its capability on the next turn.", () => {
    assert(
      property(
        integer({ min: 1, max: 200 }),
        integer({ min: 2, max: 9 }),
        integer(),
        uuid({ version: 4 }),
        uuid({ version: 4 }),
        (quote, site, seed, firstId, secondId) => {
          // Arrange
          const first = typedParse(PlayerIdSchema, firstId)
          const second = typedParse(PlayerIdSchema, secondId)
          const home = createPlanetStub({ id: "home", ownerPlayerId: first, area: site + 1 })
          const colony = createPlanetStub({ id: "colony", ownerPlayerId: second, area: site + 2 })
          const orders = [
            { playerId: first, planetId: home.id, site, type: BuildingType.TRADE_CENTER, cost: quote },
            { playerId: second, planetId: colony.id, site: site + 1, type: BuildingType.TRADE_CENTER, cost: quote + 1 },
          ]
          const state: TurnState = {
            gameId: typedParse(GameIdSchema, 1),
            turn: 3,
            players: [{ id: first }, { id: second }],
            planets: [home, colony],
            buildings: [
              { type: BuildingType.COMMAND_CENTER, planetId: home.id },
              { type: BuildingType.TRADE_CENTER, planetId: home.id },
              { type: BuildingType.COMMAND_CENTER, planetId: colony.id },
            ],
            shipMoves: [],
            constructionOrders: orders,
          }
          const before = structuredClone(state)
          // Act
          const resolved = resolveTurn(state, createSeededRng(seed))
          const replay = resolveTurn(before, createSeededRng(seed))
          const next = resolveTurn(
            { ...state, turn: 4, shipMoves: [], constructionOrders: [], buildings: [...state.buildings, ...resolved.buildingsToPlace] },
            createSeededRng(seed),
          )
          // Assert
          expect(resolved.buildingsToPlace).toStrictEqual([
            { planetId: home.id, site, type: "TRADE_CENTER" },
            { planetId: colony.id, site: site + 1, type: "TRADE_CENTER" },
          ])
          expect(resolved.creditChanges).toStrictEqual(
            new Map([
              [first, String(10 - quote)],
              [second, String(-(quote + 1))],
            ]),
          )
          expect(next.creditChanges).toStrictEqual(
            new Map([
              [first, "20"],
              [second, "10"],
            ]),
          )
          expect(next.buildingsToPlace).toStrictEqual([])
          expect(replay).toStrictEqual(resolved)
          expect(state).toStrictEqual(before)
        },
      ),
    )
  })

  it("TR-0006 When a turn resolves a submitted move, charge the full price once and travel the first segment during that turn. Each subsequent turn travels up to the departure speed on the same direct route and stops at the destination on the final segment.", () => {
    assert(
      property(integer({ min: 1, max: 60 }), integer({ min: 1, max: 12 }), integer(), (tenths, thrust, seed) => {
        // Arrange
        const playerId = typedParse(PlayerIdSchema, "9985190a-8097-4981-a5df-a83e06acbd53")
        const shipId = ShipIdSchema.parse("T-01")
        const origin: TravelBody = { kind: "planet", id: "home", name: "Home", coordinates: "01:01:01", x: 1, y: 2 }
        const destination: TravelBody = {
          kind: "star",
          id: "sun",
          name: "Sun",
          coordinates: "08:06",
          x: origin.x + tenths / 10,
          y: origin.y + 0.25,
        }
        const route = quoteTravel(origin, destination, { thrust, emptyMass: 4 }, [])
        const enRoute = Array.from({ length: route.turns - 1 }, (_, step) => ({
          shipId,
          station: null,
          trip: { route, completedTurns: step + 1 },
        }))
        const expectedUpdates = [...enRoute, { shipId, station: { kind: "star", id: "sun" }, trip: null }]
        const charges = [new Map([[playerId, String(-route.cost)]]), ...enRoute.map(() => new Map())]
        let traveled = 0
        for (let step = 0; step < route.turns; step++) {
          const state: TurnState = {
            gameId: typedParse(GameIdSchema, 1),
            turn: step + 1,
            players: [{ id: playerId }],
            planets: [],
            buildings: [],
            constructionOrders: [],
            shipMoves: [{ playerId, shipId, route, completedTurns: step }],
          }
          const before = structuredClone(state)
          // Act
          const result = resolveTurn(state, createSeededRng(seed))
          const replay = resolveTurn(before, createSeededRng(seed))
          // Assert
          expect(replay).toStrictEqual(result)
          expect(state).toStrictEqual(before)
          const expectedDistance = Math.min(route.speed, route.distance - traveled)
          expect(result.shipUpdates).toHaveLength(1)
          const [updated] = result.shipUpdates
          const expected = expectedUpdates[step]
          Assert.isDefined(expected)
          expect(updated).toMatchObject(expected)
          expect(updated?.segmentDistance).toBeCloseTo(expectedDistance, 13)
          traveled += expectedDistance
          expect(result.creditChanges).toStrictEqual(charges[step])
        }
        expect(traveled).toBeCloseTo(route.distance, 13)
      }),
    )
  })

  it("TR-0004 When trade-center income is the only effect of a turn, resolution preserves the random generator state.", () => {
    assert(
      property(integer(), uuid({ version: 4 }), (seed, id) => {
        // Arrange
        const player = typedParse(PlayerIdSchema, id)
        const home = createPlanetStub({ id: "home", ownerPlayerId: player })
        const state: TurnState = {
          gameId: typedParse(GameIdSchema, 1),
          turn: 1,
          players: [{ id: player }],
          planets: [home],
          shipMoves: [],
          constructionOrders: [],
          buildings: [{ type: BuildingType.TRADE_CENTER, planetId: home.id }],
        }
        const rng = createSeededRng(seed)
        const before = rng.getState()

        // Act
        const result = resolveTurn(state, rng)

        // Assert
        expect(result.creditChanges.get(player)).toBe("10")
        expect(rng.getState()).toStrictEqual(before)
      }),
    )
  })
})
