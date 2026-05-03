import { createConsoleLogSink, jsonLineFormatter, Logger, prettyConsoleFormatter } from "@guillaume-docquier/tools-ts"

/**
 * Configures the logger based on the env (prod vs dev).
 * This should be the first thing you do when starting an app.
 * The scope should be the name of the app (i.e api, tick-processing, etc)
 */
export async function configureLogger({ scope, nonBlocking = true }: { scope: string; nonBlocking?: boolean }): Promise<Logger> {
  const isProd = process.env.NODE_ENV === "production"
  return (
    await Logger.configure({
      sinks: {
        console: createConsoleLogSink({
          nonBlocking,
          formatter: isProd ? jsonLineFormatter : prettyConsoleFormatter,
          redaction: { enabled: isProd },
        }),
      },
    })
  ).child({ scope })
}
