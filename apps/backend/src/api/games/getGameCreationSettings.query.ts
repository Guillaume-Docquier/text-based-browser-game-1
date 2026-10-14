import { z } from "zod"

export type GetGameCreationSettingsQuery = z.infer<typeof GetGameCreationSettingsQuerySchema>
export const GetGameCreationSettingsQuerySchema = z.void()
