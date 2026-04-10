import type { Logger } from "@guillaume-docquier/tools-ts"

/**
 * A util to print the current memory usage using {@link https://nodejs.org/api/process.html#processmemoryusage process.memoryUsage()}.
 * See the implementation for more information.
 */
export function printMemoryUsage({ logger }: { logger: Logger }): void {
  const memoryUsage = process.memoryUsage() // info in bytes

  logger.info("memory usage", {
    /**
     * Resident Set Size, the total memory allocated for the whole process.
     * In Railway, this is what you pay for.
     *
     * It is basically the sum of heapTotal + external of all threads (workers).
     */
    rss: bytesToMb(memoryUsage.rss),
    /**
     * Available heap for the current thread
     */
    heapTotal: bytesToMb(memoryUsage.heapTotal),
    /**
     * Heap used for the current thread
     */
    heapUsed: bytesToMb(memoryUsage.heapUsed),
    /**
     * Memory used by C++ for the current thread, including arrayBuffers
     */
    external: bytesToMb(memoryUsage.external),
    /**
     * ArrayBuffers used for the current thread
     */
    arrayBuffers: bytesToMb(memoryUsage.arrayBuffers),
  })
}

function bytesToMb(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024).toFixed(2)} MB`
}
