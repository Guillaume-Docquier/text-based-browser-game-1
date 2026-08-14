import type { TurnContext } from "#lib/rules-engine/TurnContext.ts"

/**
 * A Phase applies the Effects it owns, records their outcomes, removes them from the Effect Pool, and mutates the Turn State.
 */
export type PhaseResolver = (context: TurnContext) => void
