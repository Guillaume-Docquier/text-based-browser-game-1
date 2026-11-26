import { EventEmitter, on } from "node:events"
import type { Result } from "@guillaume-docquier/tools-ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { GameplayRepository } from "./gameplay.repository.ts"
import type { GetTurnStateError } from "./getTurnState.error.ts"
import type { GetTurnStateQuery } from "./getTurnState.query.ts"
import type { TurnState } from "./TurnState.ts"

const SNAPSHOT_EVENT = "snapshot"

type Snapshot = Result<TurnState, GetTurnStateError>
type GameEvents = { [SNAPSHOT_EVENT]: [Snapshot] }
type GameSubscriptions = {
  events: EventEmitter<GameEvents>
  reading: boolean
  refreshRequested: boolean
}

export class GetTurnStateUseCase {
  private readonly gameplayRepository: GameplayRepository
  private readonly gameSubscriptions = new Map<GameId, GameSubscriptions>()
  private ready = false

  public constructor({ gameplayRepository }: { gameplayRepository: GameplayRepository }) {
    this.gameplayRepository = gameplayRepository
  }

  public async *execute({ gameId }: GetTurnStateQuery, signal?: AbortSignal): AsyncGenerator<Snapshot> {
    const game = this.gameSubscriptions.getOrInsertComputed(gameId, () => ({
      events: new EventEmitter<GameEvents>().setMaxListeners(0),
      reading: false,
      refreshRequested: false,
    }))

    try {
      const snapshots = on(game.events, SNAPSHOT_EVENT, { signal })
      void this.refresh(gameId)
      for await (const [snapshot] of snapshots) {
        yield snapshot
      }
    } finally {
      this.removeGameIfIdle(gameId)
    }
  }

  public listenerReady(): void {
    this.ready = true
    for (const gameId of this.gameSubscriptions.keys()) {
      void this.refresh(gameId)
    }
  }

  public async refresh(gameId: GameId): Promise<void> {
    const game = this.gameSubscriptions.get(gameId)
    if (!this.ready || game === undefined) {
      return
    }

    game.refreshRequested = true
    if (game.reading) {
      return
    }

    game.reading = true
    try {
      while (game.refreshRequested && game.events.listenerCount(SNAPSHOT_EVENT) > 0) {
        game.refreshRequested = false
        const snapshot = await this.gameplayRepository.getTurnState({ gameId })
        game.events.emit(SNAPSHOT_EVENT, snapshot)
      }
    } finally {
      game.reading = false
      this.removeGameIfIdle(gameId)
    }
  }

  private removeGameIfIdle(gameId: GameId): void {
    const game = this.gameSubscriptions.get(gameId)
    if (game?.reading === false && game.events.listenerCount(SNAPSHOT_EVENT) === 0) {
      this.gameSubscriptions.delete(gameId)
    }
  }
}
