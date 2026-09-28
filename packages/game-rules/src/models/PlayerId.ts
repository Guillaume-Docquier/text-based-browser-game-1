import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export type PlayerId = Branded<"PlayerId", string>
export const PlayerIdSchema = z.uuid().transform(branded<PlayerId>)
