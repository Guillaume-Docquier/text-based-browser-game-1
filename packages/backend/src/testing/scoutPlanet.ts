import { Assert } from "@guillaume-docquier/tools-ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { BodyRef } from "shared/domain/world/ships/travel.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { AuthenticatedApiClient } from "./ApiClient.ts"

export async function advanceTestTurn(
  gameId: GameId,
  turn: number,
  players: readonly AuthenticatedApiClient[],
  worker: TurnProcessor,
): Promise<void> {
  for (const player of players) {
    await player.client.gameplay.updateReadiness.mutate({ gameId, turn, isReady: true })
  }
  Assert.isTrue((await worker.processNextDueTurn()) === "processed")
}
export async function flyTo({
  gameId,
  owner,
  players,
  worker,
  destination,
}: {
  gameId: GameId
  owner: AuthenticatedApiClient
  players: readonly AuthenticatedApiClient[]
  worker: TurnProcessor
  destination: BodyRef
}): Promise<number> {
  const view = await owner.client.gameplay.getPlayerView.query({ gameId })
  const ship = view.ships.find((s) => s.ownerPlayerId === view.player.id)
  Assert.isDefined(ship)
  await owner.client.gameplay.moveShip.mutate({ gameId, turn: view.turn, action: "submit", shipId: ship.id, destination })
  const planned = await owner.client.gameplay.getPlayerView.query({ gameId })
  const order = planned.ships.find((s) => s.id === ship.id)?.order
  Assert.isDefined(order)
  for (let step = 0; step < order.route.turns; step++) {
    await advanceTestTurn(gameId, view.turn + step, players, worker)
  }
  return view.turn + order.route.turns
}
