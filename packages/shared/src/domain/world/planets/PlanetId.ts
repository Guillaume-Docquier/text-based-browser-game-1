import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export type PlanetId = Branded<"PlanetId", string>
export const PlanetIdSchema = z.string().transform(branded<PlanetId>)
