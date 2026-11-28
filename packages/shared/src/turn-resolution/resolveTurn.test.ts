import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { assert, integer, property, uuid } from "fast-check"
import { describe, expect, it } from "vitest"
import { GameIdSchema } from "#shared/domain/games/GameId.ts"
import { PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import { createSeededRng } from "#shared/testing/createSeededRng.ts"
import { resolveTurn } from "#shared/turn-resolution/resolveTurn.ts"
import type { TurnState } from "#shared/turn-resolution/TurnState.ts"

describe("resolveTurn", () => {
  it("TR-0001 Resolving an empty turn preserves the supplied turn state.", () => {
    assert(
      property(integer({ min: 1, max: 100 }), uuid({ version: 4 }), uuid({ version: 4 }), (turn, playerId, planetId) => {
        // Arrange
        const state: TurnState = {
          gameId: typedParse(GameIdSchema, 1),
          turn,
          players: [{ id: typedParse(PlayerIdSchema, playerId) }],
          planets: [createPlanetStub({ id: planetId, ownerPlayerId: playerId })],
        }
        const before = structuredClone(state)

        // Act
        resolveTurn(state, createSeededRng())

        // Assert
        expect(state).toStrictEqual(before)
      }),
    )
  })

  it("TR-0002 Resolving an empty turn preserves the random generator state.", () => {
    assert(
      property(integer(), (seed) => {
        // Arrange
        const state: TurnState = { gameId: typedParse(GameIdSchema, 1), turn: 1, players: [], planets: [] }
        const rng = createSeededRng(seed)
        const before = rng.getState()

        // Act
        resolveTurn(state, rng)

        // Assert
        expect(rng.getState()).toStrictEqual(before)
      }),
    )
  })
})
