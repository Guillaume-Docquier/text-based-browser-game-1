import z from "zod"
import {
  ResourceGainMechanicSchema,
  type ResourceGainMechanic,
} from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceGainMechanic.ts"
import {
  ResourceLossMechanicSchema,
  type ResourceLossMechanic,
} from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceLossMechanic.ts"
import { VictoryMechanicSchema, type VictoryMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/VictoryMechanic.ts"

export type Mechanic = ResourceLossMechanic | ResourceGainMechanic | VictoryMechanic

export const MechanicSchema = z.discriminatedUnion("type", [ResourceLossMechanicSchema, ResourceGainMechanicSchema, VictoryMechanicSchema])
