import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export type AccountId = Branded<"AccountId", string>
export const AccountIdSchema = z.uuid().transform(branded<AccountId>)
