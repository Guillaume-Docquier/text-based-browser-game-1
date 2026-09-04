import type { LobbyStatus } from "@api-types"

export function formatLobbyStatus(gameStatus: LobbyStatus): string {
  switch (gameStatus) {
    case "WAITING_FOR_PLAYERS":
      return "Waiting for more players"
    case "READY_TO_START":
      return "Ready to start"
    case "IN_PROGRESS":
      return "In progress"
    case "ENDED":
      return "Ended"
  }
}
