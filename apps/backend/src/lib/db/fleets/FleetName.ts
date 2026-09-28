import { varchar } from "drizzle-orm/pg-core"
import { FLEET_NAME_MAX_LENGTH, type FleetName } from "game-rules/models/FleetName.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const fleetNameColumn = (name: string) => varchar(name, { length: FLEET_NAME_MAX_LENGTH }).$type<FleetName>()
