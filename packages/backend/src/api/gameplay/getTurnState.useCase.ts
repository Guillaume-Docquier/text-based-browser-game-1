import type { Result } from "@guillaume-docquier/tools-ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { GameplayRepository } from "./gameplay.repository.ts"
import type { GetTurnStateError } from "./getTurnState.error.ts"
import type { GetTurnStateQuery } from "./getTurnState.query.ts"
import type { TurnState } from "./TurnState.ts"

type Snapshot = Result<TurnState, GetTurnStateError>
type Subscriber = { send: (snapshot: Snapshot) => void; needsInitial: boolean }
type GameStream = {
  subscribers: Set<Subscriber>
  reading: boolean
  dirty: boolean
}

export class GetTurnStateUseCase {
  private readonly gameplayRepository: GameplayRepository
  private readonly games = new Map<GameId, GameStream>()
  private ready = false

  public constructor({ gameplayRepository }: { gameplayRepository: GameplayRepository }) {
    this.gameplayRepository = gameplayRepository
  }

  public listenerReady(): void {
    this.ready = true
    for (const gameId of this.games.keys()) {
      this.refresh(gameId)
    }
  }

  public refresh(gameId: GameId): void {
    const game = this.games.get(gameId)
    if (game === undefined || game.subscribers.size === 0 || !this.ready) {
      return
    }
    if (game.reading) {
      game.dirty = true
      return
    }
    void this.read(gameId, game, true)
  }

  private async read(gameId: GameId, game: GameStream, broadcast: boolean): Promise<void> {
    game.reading = true
    try {
      do {
        game.dirty = false
        const snapshot = await this.gameplayRepository.getTurnState({ gameId })
        for (const subscriber of game.subscribers) {
          if (broadcast || subscriber.needsInitial) {
            subscriber.send(snapshot)
            subscriber.needsInitial = false
          }
        }
        broadcast = true
      } while (game.dirty && game.subscribers.size > 0)
    } finally {
      game.reading = false
      if (game.subscribers.size === 0) {
        this.games.delete(gameId)
      }
    }
  }

  public async *execute({ gameId }: GetTurnStateQuery, signal: AbortSignal = new AbortController().signal): AsyncGenerator<Snapshot> {
    const game = this.games.get(gameId) ?? { subscribers: new Set<Subscriber>(), reading: false, dirty: false }
    this.games.set(gameId, game)
    let pending: Snapshot | undefined
    let wake = Promise.withResolvers<undefined>()
    const cancel = (): void => {
      wake.resolve(undefined)
    }
    const send = (snapshot: Snapshot): void => {
      pending = snapshot
      wake.resolve(undefined)
    }
    const subscriber = { send, needsInitial: true }
    game.subscribers.add(subscriber)
    signal.addEventListener("abort", cancel, { once: true })
    try {
      if (this.ready && !game.reading) {
        void this.read(gameId, game, false)
      }
      while (!signal.aborted) {
        await wake.promise
        wake = Promise.withResolvers<undefined>()
        if (pending !== undefined && !signal.aborted) {
          const snapshot = pending
          pending = undefined
          yield snapshot
        }
      }
    } finally {
      signal.removeEventListener("abort", cancel)
      game.subscribers.delete(subscriber)
      if (game.subscribers.size === 0 && !game.reading) {
        this.games.delete(gameId)
      }
    }
  }
}
