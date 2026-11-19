import { type Logger, Profile } from "@guillaume-docquier/tools-ts"

export function monitorMemoryUsage({ logger }: { logger: Logger }): void {
  setInterval(() => {
    Profile.memoryUsage(logger)
  }, 60_000)
}
