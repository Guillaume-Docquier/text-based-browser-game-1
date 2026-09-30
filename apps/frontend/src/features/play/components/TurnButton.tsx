import { type ReactElement, useId } from "react"
import "./TurnButton.css"

/**
 * Displays the turn clock and the reversible lock-in action in one control.
 */
export function TurnButton({
  turn,
  countdown,
  deadline,
  isLockedIn,
  disabled,
  isPending,
  onToggle,
}: {
  turn: number
  countdown: string
  deadline: string
  isLockedIn: boolean
  disabled: boolean
  isPending: boolean
  onToggle: () => void
}): ReactElement {
  const descriptionId = useId()

  return (
    <button
      type="button"
      className="turn-button"
      aria-label={isLockedIn ? "Cancel lock in" : "Lock in"}
      aria-pressed={isLockedIn}
      aria-describedby={descriptionId}
      aria-busy={isPending}
      title={deadline}
      disabled={disabled}
      onClick={onToggle}
    >
      <span className="turn-button__details" id={descriptionId}>
        <span className="turn-button__label">{isLockedIn ? "Locked in" : "Next turn"}</span>
        <span className="turn-button__countdown">{countdown}</span>
        <span className="turn-button__label">Turn {turn}</span>
      </span>
      <span className="turn-button__action" aria-hidden="true">
        {isLockedIn ? "Cancel" : "Lock in"}
      </span>
    </button>
  )
}
