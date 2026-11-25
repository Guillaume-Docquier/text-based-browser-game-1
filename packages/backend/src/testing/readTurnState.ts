import type { GameId } from "shared/domain/games/GameId.ts"
import type { TurnState } from "#api/types.ts"
import type { AuthenticatedApiClient, AnonymousApiClient } from "./ApiClient.ts"

export async function readTurnState({ client }: AuthenticatedApiClient | AnonymousApiClient, gameId: GameId): Promise<TurnState> {
  const snapshot = Promise.withResolvers<TurnState>()
  const subscription = client.gameplay.turnState.subscribe({ gameId }, { onData: snapshot.resolve, onError: snapshot.reject })

  try {
    return await snapshot.promise
  } finally {
    subscription.unsubscribe()
  }
}
