import { simplePhaseResolver } from "#lib/rules-engine/turn-resolution/phases/implementations/simplePhaseResolver.ts"
import type { PhaseResolver } from "#lib/rules-engine/turn-resolution/phases/PhaseResolver.ts"

export const resolveFleetBuildPhase: PhaseResolver = (context) => simplePhaseResolver("FLEET_BUILD", context)
