import { branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import type { FleetId } from "#game-rules/models/FleetId.ts"
import type { PlanetId } from "#game-rules/models/PlanetId.ts"
import type { PlayerId } from "#game-rules/models/PlayerId.ts"

export type TargetId = FleetId | PlanetId | PlayerId
export const TargetIdSchema = z.string().transform(branded<TargetId>) satisfies z.ZodType<TargetId>
