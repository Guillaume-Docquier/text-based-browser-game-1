import { z } from "zod"

export type GetGameListingsQuery = z.infer<typeof GetGameListingsQuerySchema>
export const GetGameListingsQuerySchema = z.void()
