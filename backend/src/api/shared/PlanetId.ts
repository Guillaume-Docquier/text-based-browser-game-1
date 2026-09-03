import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

/** The identifier of a planet within a game. */
export type PlanetId = Branded<number, "PlanetId">

/** Parses a number as a planet identifier. */
export const PlanetId = z.number().transform(branded<PlanetId>)
