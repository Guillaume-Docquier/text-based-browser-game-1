import { type ReactElement, useId } from "react"
import { cn } from "@/lib/cn.ts"

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
  // Pending requests block clicks without resetting the hovered appearance.
  const showInteraction = !disabled || isPending

  return (
    <button
      type="button"
      className={cn(
        "group/turn relative grid h-full min-h-20 w-48 max-w-full cursor-pointer border-0 border-b-2 bg-transparent px-4 py-2 text-amber-400 focus-visible:outline-2 focus-visible:-outline-offset-2",
        isLockedIn ? "border-lime-400 focus-visible:outline-lime-400" : "border-amber-500/60 focus-visible:outline-amber-500",
        {
          "hover:border-lime-400 hover:bg-lime-400/10 hover:text-lime-400 focus-visible:border-lime-400 focus-visible:bg-lime-400/10 focus-visible:text-lime-400 focus-visible:outline-lime-400":
            showInteraction && !isLockedIn,
          "hover:border-red-400 hover:bg-red-400/10 hover:text-red-400 focus-visible:border-red-400 focus-visible:bg-red-400/10 focus-visible:text-red-400 focus-visible:outline-red-400":
            showInteraction && isLockedIn,
          "cursor-default opacity-60": !showInteraction,
        },
      )}
      aria-label={isLockedIn ? "Cancel lock in" : "Lock in"}
      aria-pressed={isLockedIn}
      aria-describedby={descriptionId}
      aria-busy={isPending}
      title={deadline}
      disabled={disabled}
      onClick={onToggle}
    >
      <span
        className={cn("relative col-start-1 row-start-1 grid gap-[0.15rem] self-center text-center", {
          "group-hover/turn:opacity-0 group-focus-visible/turn:opacity-0": showInteraction,
        })}
        id={descriptionId}
      >
        <span className="text-[0.65rem] tracking-[0.16em] uppercase">{isLockedIn ? "Locked in" : "Next turn"}</span>
        <span className="text-2xl leading-[1.2] tracking-[0.08em] tabular-nums">{countdown}</span>
        <span className="text-[0.65rem] tracking-[0.16em] uppercase">Turn {turn}</span>
      </span>
      <span
        className={cn(
          "invisible relative col-start-1 row-start-1 self-center text-center text-2xl leading-normal font-semibold tracking-[0.15em] uppercase",
          {
            "group-hover/turn:visible group-focus-visible/turn:visible": showInteraction,
          },
        )}
        aria-hidden="true"
      >
        {isLockedIn ? "Cancel" : "Lock in"}
      </span>
    </button>
  )
}
