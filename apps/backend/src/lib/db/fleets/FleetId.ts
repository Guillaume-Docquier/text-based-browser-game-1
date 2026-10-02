import { uuid } from "drizzle-orm/pg-core"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const fleetIdColumn = (name: string) => uuid(name).$type<FleetId>()
