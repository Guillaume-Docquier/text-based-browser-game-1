import { branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import type { FleetId } from "#lib/db/fleets/FleetId.ts"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"

export type TargetId = FleetId | PlanetId | PlayerId
export const TargetIdSchema = z.string().transform(branded<TargetId>) satisfies z.ZodType<TargetId>
