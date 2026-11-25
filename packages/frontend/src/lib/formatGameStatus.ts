import { GameStatus } from "shared/domain/games/GameStatus.ts"

export function formatGameStatus(gameStatus: GameStatus): string {
  switch (gameStatus) {
    case GameStatus.WAITING_FOR_PLAYERS:
      return "Waiting for more players"
    case GameStatus.READY_TO_START:
      return "Ready to start"
    case GameStatus.IN_PROGRESS:
      return "In progress"
    case GameStatus.ENDED:
      return "Ended"
  }
}
