import { branded, type Branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

/** The identifier of an account. */
export type AccountId = Branded<string, "AccountId">

/** Parses a string as an account identifier. */
export const AccountId = z.string().transform(branded<AccountId>)
