import { Router } from "express"

export function createHealthRouter(): Router {
  const router = Router()

  router.get("/health", (_req, res): void => {
    res.status(200).end()
  })

  return router
}
