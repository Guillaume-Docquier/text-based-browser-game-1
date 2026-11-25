import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"

export function formatTurnStatus(status: TurnStatus): string {
  switch (status) {
    case TurnStatus.COLLECTING_ACTIONS:
      return "Collecting actions"
    case TurnStatus.AWAITING_PROCESSING:
      return "Awaiting processing"
    case TurnStatus.PROCESSING:
      return "Processing"
    case TurnStatus.COMPLETED:
      return "Completed"
  }
}
