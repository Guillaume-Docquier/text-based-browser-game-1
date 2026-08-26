import type { LobbyStatus } from "@api-types"

export function formatLobbyStatus(gameStatus: LobbyStatus): string {
  switch (gameStatus) {
    case "WAITING_FOR_PLAYERS":
      return "Waiting for more players"
    case "READY_TO_START":
      return "Ready to start"
    case "COLLECTING_ACTIONS":
      return "Collecting actions"
    case "AWAITING_PROCESSING":
      return "Awaiting processing"
    case "PROCESSING_TURN":
      return "Processing turn"
    case "ENDED":
      return "Ended"
  }
}
