import { z } from "zod"
import { type FleetId, FleetIdSchema } from "#lib/db/fleets/FleetId.ts"
import { type PlanetId, PlanetIdSchema } from "#lib/db/planets/PlanetId.ts"
import { type PlayerId, PlayerIdSchema } from "#lib/db/players/PlayerId.ts"

export type TargetId = FleetId | PlanetId | PlayerId
export const TargetIdSchema = z.union([FleetIdSchema, PlanetIdSchema, PlayerIdSchema])
