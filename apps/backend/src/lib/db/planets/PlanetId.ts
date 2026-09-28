import { text } from "drizzle-orm/pg-core"
import type { PlanetId } from "game-rules/models/PlanetId.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const planetIdColumn = (name: string) => text(name).$type<PlanetId>()
