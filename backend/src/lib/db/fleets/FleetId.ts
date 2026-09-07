import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { uuid } from "drizzle-orm/pg-core"
import { z } from "zod"

export type FleetId = Branded<string, "FleetId">
export const FleetId = z.string().transform(branded<FleetId>)

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const fleetIdColumn = (name: string) => uuid(name).$type<FleetId>()
