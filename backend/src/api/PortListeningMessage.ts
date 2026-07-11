import { z } from "zod"

/**
 * Message sent from the forked api to the concurrency tests to tell it which port the api is on.
 */
export type PortListeningMessage = z.infer<typeof PortListeningMessage>
export const PortListeningMessage = z.object({
  type: z.literal("listening"),
  port: z.coerce.number(),
})
