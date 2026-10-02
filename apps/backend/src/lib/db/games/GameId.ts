import { integer } from "drizzle-orm/pg-core"
import type { GameId } from "shared/domain/game/GameId.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let drizzle inference do the work
export const gameIdColumn = (name: string) => integer(name).$type<GameId>()
