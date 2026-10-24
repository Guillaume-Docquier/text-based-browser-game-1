import { buildFleet } from "./buildFleet.ts"
import { gainResources } from "./gainResources.ts"
import { moveFleet } from "./moveFleet.ts"
import { spendResources } from "./spendResources.ts"
import { winGame } from "./winGame.ts"

/**
 * Immutable, engine-owned vocabulary; importing it performs no registration.
 */
export const mechanicRegistry = { gainResources, spendResources, buildFleet, moveFleet, winGame } as const
