import type { UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v4 } from "uuid"
import { FleetSchema, type Fleet } from "#shared/domain/world/fleets/Fleet.ts"

export function createFleetStub({ id = v4(), ...overrides }: Partial<UnbrandedProperties<Fleet>> = {}): Fleet {
  return typedParse(FleetSchema, {
    id,
    ownerPlayerId: v4(),
    name: "fleet-" + id.slice(0, 8),
    strength: 1,
    originPlanetId: v4(),
    ...overrides,
  })
}
