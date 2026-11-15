import type { PlayerView } from "@api-types"

export function formatTurnStatus(status: PlayerView["turnStatus"]): string {
  switch (status) {
    case "COLLECTING_ACTIONS":
      return "Collecting actions"
    case "AWAITING_PROCESSING":
      return "Awaiting processing"
    case "PROCESSING":
      return "Processing"
    case "COMPLETED":
      return "Completed"
  }
}
