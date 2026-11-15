import { text } from "drizzle-orm/pg-core"
import type { StarId } from "shared/domain/world/stars/StarId.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const starIdColumn = (name: string) => text(name).$type<StarId>()
