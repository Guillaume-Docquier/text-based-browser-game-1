import { EventEmitter, on } from "node:events"
import { setTimeout } from "node:timers"
import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import type { GameplayRepository } from "./gameplay.repository.ts"
import { TurnStateError } from "./turnState.error.ts"
import type { TurnStateQuery } from "./turnState.query.ts"
import type { TurnState } from "./TurnState.ts"

type TurnStateResult = Result<TurnState, TurnStateError>
type GameSubscription = {
  readonly events: EventEmitter<{ snapshot: [TurnStateResult] }>
  needsRefresh: boolean
  isReading: boolean
  retry: ReturnType<typeof setTimeout> | undefined
}

export class TurnStateUseCase {
  private readonly gameplayRepository: GameplayRepository
  private readonly logger: Logger
  private readonly games = new Map<GameId, GameSubscription>()

  public constructor({ gameplayRepository, logger }: { gameplayRepository: GameplayRepository; logger: Logger }) {
    this.gameplayRepository = gameplayRepository
    this.logger = logger.child({ scope: "turn-state" })
  }

  public async *execute(
    { gameId }: TurnStateQuery,
    { playerId, signal }: { playerId: PlayerId; signal: AbortSignal | undefined },
  ): AsyncGenerator<TurnStateResult, void> {
    if (signal?.aborted === true) {
      return
    }

    let game = this.games.get(gameId)
    if (game === undefined) {
      game = { events: new EventEmitter().setMaxListeners(0), needsRefresh: false, isReading: false, retry: undefined }
      this.games.set(gameId, game)
    }

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Node's on() omits the event argument types, which the emitter enforces.
    const snapshots = on(game.events, "snapshot", signal === undefined ? {} : { signal }) as NodeJS.AsyncIterator<[TurnStateResult]>
    if (!game.isReading) {
      this.refresh(gameId)
    }

    try {
      for await (const [snapshot] of snapshots) {
        if (Result.isSuccess(snapshot) && !Object.hasOwn(snapshot.value.readinessByPlayerId, playerId)) {
          yield Result.Failure(TurnStateError.NOT_A_MEMBER)
          return
        }

        yield snapshot
      }
    } catch (error: unknown) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        throw error
      }
    } finally {
      await snapshots.return?.()
      this.removeUnusedGame(gameId, game)
    }
  }

  public refresh(gameId: GameId): void {
    const game = this.games.get(gameId)
    if (game === undefined || game.events.listenerCount("snapshot") === 0) {
      return
    }

    game.needsRefresh = true
    if (!game.isReading && game.retry === undefined) {
      void this.readSnapshots(gameId, game)
    }
  }

  public refreshAll(): void {
    for (const gameId of this.games.keys()) {
      this.refresh(gameId)
    }
  }

  private async readSnapshots(gameId: GameId, game: GameSubscription): Promise<void> {
    game.isReading = true
    try {
      while (game.needsRefresh && game.events.listenerCount("snapshot") > 0) {
        game.needsRefresh = false
        const snapshot = await this.gameplayRepository.getTurnState(gameId)
        if (Result.isFailure(snapshot)) {
          this.logger.error("Could not read turn state", { gameId, error: snapshot.error })
          game.retry = setTimeout(() => {
            game.retry = undefined
            this.refresh(gameId)
          }, 1_000).unref()
          return
        }

        game.events.emit(
          "snapshot",
          snapshot.value === undefined ? Result.Failure(TurnStateError.TURN_NOT_FOUND) : Result.Success(snapshot.value),
        )
      }
    } finally {
      game.isReading = false
      this.removeUnusedGame(gameId, game)
    }
  }

  private removeUnusedGame(gameId: GameId, game: GameSubscription): void {
    if (!game.isReading && game.events.listenerCount("snapshot") === 0) {
      clearTimeout(game.retry)
      this.games.delete(gameId)
    }
  }
}
