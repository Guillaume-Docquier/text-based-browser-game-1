import type { Logger } from "@guillaume-docquier/tools-ts"
import type { RequestHandler } from "express"

export function requestLoggerMiddleware({ logger }: { logger: Logger }): RequestHandler {
  const requestLogger = logger.child({ scope: "request" })
  return (req, _res, next) => {
    requestLogger.debug("⬅️", {
      method: req.method,
      path: req.path,
      body: req.body,
      query: req.query,
    })

    next()
  }
}
