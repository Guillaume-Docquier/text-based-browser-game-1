import { Router } from "express"

/**
 * Exposes GET /health, which returns an empty 200 response when the API can serve requests.
 * Use for deployment health checks or other probes of API availability.
 */
export function createHealthRouter(): Router {
  const router = Router()

  router.get("/health", (_req, res): void => {
    res.status(200).end()
  })

  return router
}
