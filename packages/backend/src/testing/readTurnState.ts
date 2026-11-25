import type { GameId } from "shared/domain/games/GameId.ts"
import type { TurnState } from "#api/types.ts"
import type { AuthenticatedApiClient } from "#testing/ApiClient.ts"

export async function readTurnState({ client }: AuthenticatedApiClient, gameId: GameId): Promise<TurnState> {
  const snapshot = Promise.withResolvers<TurnState>()
  const subscription = client.gameplay.turnState.subscribe(
    { gameId },
    {
      signal: AbortSignal.timeout(5_000),
      onData: snapshot.resolve,
      onError: snapshot.reject,
      onComplete: () => {
        snapshot.reject(new Error("The turn state stream closed before sending a snapshot"))
      },
    },
  )

  try {
    return await snapshot.promise
  } finally {
    subscription.unsubscribe()
  }
}
