import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { integer } from "drizzle-orm/pg-core"
import { z } from "zod"

export type PlanetId = Branded<number, "PlanetId">
export const PlanetId = z.number().transform(branded<PlanetId>)

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const planetIdColumn = (name: string) => integer(name).$type<PlanetId>()
