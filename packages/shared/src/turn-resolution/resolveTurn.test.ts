import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { assert, integer, property, uuid } from "fast-check"
import { describe, expect, it } from "vitest"
import { GameIdSchema } from "#shared/domain/games/GameId.ts"
import { PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { BuildingType } from "#shared/domain/world/buildings/Building.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
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
          buildings: [],
          planets: [createPlanetStub({ id: planetId, ownerPlayerId: playerId })],
        }
        const before = structuredClone(state)

        // Act
        const result = resolveTurn(state, createSeededRng())

        // Assert
        expect(state).toStrictEqual(before)
        expect(result.creditIncome.size).toBe(0)
      }),
    )
  })

  it("TR-0002 Resolving an empty turn preserves the random generator state.", () => {
    assert(
      property(integer(), (seed) => {
        // Arrange
        const state: TurnState = { gameId: typedParse(GameIdSchema, 1), turn: 1, players: [], planets: [], buildings: [] }
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
        expect(result.creditIncome).toStrictEqual(
          new Map([
            [first, 10 * (1 + extraCenters)],
            [second, 10 * otherCenters],
          ]),
        )
        expect(replay).toStrictEqual(result)
        expect(state).toStrictEqual(snapshot)
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
          buildings: [{ type: BuildingType.TRADE_CENTER, planetId: home.id }],
        }
        const rng = createSeededRng(seed)
        const before = rng.getState()

        // Act
        const result = resolveTurn(state, rng)

        // Assert
        expect(result.creditIncome.get(player)).toBe(10)
        expect(rng.getState()).toStrictEqual(before)
      }),
    )
  })
})
