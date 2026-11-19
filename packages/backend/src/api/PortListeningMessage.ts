import { z } from "zod"

export type PortListeningMessage = z.infer<typeof PortListeningMessageSchema>
export const PortListeningMessageSchema = z.object({
  type: z.literal("listening"),
  port: z.coerce.number(),
})
