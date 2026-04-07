import type { GameSummaryStatus } from "@api-types"

export function formatGameSummaryStatus(gameStatus: GameSummaryStatus): string {
  switch (gameStatus) {
    case "WAITING_FOR_PLAYERS":
      return "Waiting for more players"
    case "READY_TO_START":
      return "Ready to start"
    case "STARTED":
      return "In Progress"
    case "ENDED":
      return "Ended"
  }
}
