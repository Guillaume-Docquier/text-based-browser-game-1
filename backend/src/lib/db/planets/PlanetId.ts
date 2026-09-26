import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { text } from "drizzle-orm/pg-core"
import { z } from "zod"

export type PlanetId = Branded<"PlanetId", string>
export const PlanetIdSchema = z.string().transform(branded<PlanetId>)

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const planetIdColumn = (name: string) => text(name).$type<PlanetId>()
