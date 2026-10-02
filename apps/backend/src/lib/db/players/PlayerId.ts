import { uuid } from "drizzle-orm/pg-core"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const playerIdColumn = (name: string) => uuid(name).$type<PlayerId>()
