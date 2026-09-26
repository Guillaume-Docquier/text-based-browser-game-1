import { z } from "zod"
import { FleetBuildMechanicSchema } from "#lib/rules-engine/ruleset/mechanics/implementations/FleetBuildMechanic.ts"
import { ResourceGainMechanicSchema } from "#lib/rules-engine/ruleset/mechanics/implementations/ResourceGainMechanic.ts"
import { ResourceLossMechanicSchema } from "#lib/rules-engine/ruleset/mechanics/implementations/ResourceLossMechanic.ts"
import { VictoryMechanicSchema } from "#lib/rules-engine/ruleset/mechanics/implementations/VictoryMechanic.ts"

export type Mechanic = z.infer<typeof MechanicSchema>

export const MechanicSchema = z.discriminatedUnion("type", [
  ResourceLossMechanicSchema,
  ResourceGainMechanicSchema,
  VictoryMechanicSchema,
  FleetBuildMechanicSchema,
])
