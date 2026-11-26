import { Assert } from "@guillaume-docquier/tools-ts"
import type { TRPCClient } from "@trpc/client"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { TrpcRouter, TurnState } from "#api/types.ts"

export async function readTurnState(client: TRPCClient<TrpcRouter>, gameId: GameId): Promise<TurnState> {
  using stream = subscribeToTurnState(client, gameId)
  return await stream.next()
}

export function subscribeToTurnState(client: TRPCClient<TrpcRouter>, gameId: GameId): Disposable & { next: () => Promise<TurnState> } {
  let subscription: { unsubscribe: () => void }
  const snapshots = new ReadableStream<TurnState>({
    start(controller): void {
      subscription = client.gameplay.turnState.subscribe(
        { gameId },
        {
          onData: (snapshot) => {
            controller.enqueue(snapshot)
          },
          onError: (error) => {
            controller.error(error)
          },
        },
      )
    },
  })
  const reader = snapshots.getReader()
  return {
    next: async () => {
      const snapshot = await reader.read()
      Assert.isDefined(snapshot.value)
      return snapshot.value
    },
    [Symbol.dispose]() {
      subscription.unsubscribe()
    },
  }
}
