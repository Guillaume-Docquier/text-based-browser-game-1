import { text } from "drizzle-orm/pg-core"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const planetIdColumn = (name: string) => text(name).$type<PlanetId>()
