import { type Logger, Profile } from "@guillaume-docquier/tools-ts"

/**
 * Logs memory usage snapshots to compare with what Railway says
 * The memory used as reported by node is smaller than what Railway is billing me by quite a margin... (like billed 230MB when RSS is at 150MB)
 */
export function monitorMemoryUsage({ logger }: { logger: Logger }): void {
  setInterval(() => {
    Profile.memoryUsage(logger)
  }, 60_000)
}
