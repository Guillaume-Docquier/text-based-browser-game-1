import { branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"

export type TargetId = FleetId | PlanetId | PlayerId
export const TargetIdSchema = z.string().transform(branded<TargetId>) satisfies z.ZodType<TargetId>
