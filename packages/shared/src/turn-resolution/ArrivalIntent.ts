import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import type { ActionResolutionOrigin } from "#shared/domain/turns/actions/ActionResolutionOrigin.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import type { PendingArrivalEffect } from "#shared/domain/world/fleets/PendingArrivalEffect.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
export type ArrivalTick = Branded<"ArrivalTick", number>
export const ArrivalTickSchema = z
  .number()
  .int()
  .min(0)
  .max(20)
  .transform(branded<ArrivalTick>)
/** Immutable priority and historical selection; only the actual binding redirects. */
export type ArrivalIntent = Readonly<{
  origin: ActionResolutionOrigin
  departureFleetId: FleetId
  destinationPlanetId: PlanetId
  arrivalTurn: number
  tick: ArrivalTick
  pending: PendingArrivalEffect
}> & { actualFleetId: FleetId }
