import { varchar } from "drizzle-orm/pg-core"
import { PLANET_NAME_MAX_LENGTH, type PlanetName } from "game-rules/models/PlanetName.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const planetNameColumn = (name: string) => varchar(name, { length: PLANET_NAME_MAX_LENGTH }).$type<PlanetName>()
