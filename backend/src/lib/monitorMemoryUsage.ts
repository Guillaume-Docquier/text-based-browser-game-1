import { type Logger, Profile, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { repeat } from "#lib/repeat.ts"

export function monitorMemoryUsage({ logger }: { logger: Logger }): void {
  // We'll capture the memory usage reported by node a few times to compare with what Railway says
  // There's always a spike at launch, which should settle after a minute or two
  repeat({
    times: 5,
    delay: Time.create(1, UnitOfTime.MINUTES),
    operation: () => {
      Profile.memoryUsage(logger)
    },
  })
}
