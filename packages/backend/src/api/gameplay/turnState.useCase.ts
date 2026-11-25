import { EventEmitter, on } from "node:events"
import type { Result } from "@guillaume-docquier/tools-ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { GameplayRepository } from "./gameplay.repository.ts"
import type { TurnStateError } from "./turnState.error.ts"
import type { TurnStateQuery } from "./turnState.query.ts"
import type { TurnState } from "./TurnState.ts"

type Snapshot = Result<TurnState, TurnStateError>
type GameSubscriptions = {
  events: EventEmitter<{ snapshot: [Snapshot] }>
  reading: boolean
  refreshRequested: boolean
}

export class TurnStateUseCase {
  private readonly repository: GameplayRepository
  private readonly games = new Map<GameId, GameSubscriptions>()

  public constructor(repository: GameplayRepository) {
    this.repository = repository
  }

  public async *execute({ gameId }: TurnStateQuery, signal: AbortSignal | undefined): AsyncGenerator<Snapshot> {
    if (signal?.aborted === true) {
      return
    }

    const game = this.games.get(gameId) ?? {
      events: new EventEmitter<{ snapshot: [Snapshot] }>().setMaxListeners(0),
      reading: false,
      refreshRequested: false,
    }
    this.games.set(gameId, game)

    const snapshots = on(game.events, "snapshot", signal === undefined ? {} : { signal })
    this.refresh(gameId)

    try {
      for await (const [snapshot] of snapshots) {
        yield snapshot
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        throw error
      }
    } finally {
      this.removeIdleGame(gameId, game)
    }
  }

  public refreshAll(): void {
    for (const gameId of this.games.keys()) {
      this.refresh(gameId)
    }
  }

  public refresh(gameId: GameId): void {
    const game = this.games.get(gameId)
    if (game === undefined) {
      return
    }

    game.refreshRequested = true
    if (!game.reading) {
      void this.readSnapshots(gameId, game)
    }
  }

  private async readSnapshots(gameId: GameId, game: GameSubscriptions): Promise<void> {
    game.reading = true
    try {
      while (game.refreshRequested && game.events.listenerCount("snapshot") > 0) {
        game.refreshRequested = false
        const snapshot = await this.repository.getTurnState(gameId)
        game.events.emit("snapshot", snapshot)
      }
    } finally {
      game.reading = false
      this.removeIdleGame(gameId, game)
    }
  }

  private removeIdleGame(gameId: GameId, game: GameSubscriptions): void {
    if (!game.reading && game.events.listenerCount("snapshot") === 0 && this.games.get(gameId) === game) {
      this.games.delete(gameId)
    }
  }
}
