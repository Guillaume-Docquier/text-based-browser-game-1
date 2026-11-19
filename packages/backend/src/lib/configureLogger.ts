import { createConsoleLogSink, jsonLineFormatter, Logger, prettyConsoleFormatter } from "@guillaume-docquier/tools-ts"

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
