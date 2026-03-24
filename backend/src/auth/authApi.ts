import type { RequestHandler } from "express"
import { getAuth } from "@clerk/express"

export const authApi: RequestHandler = (req, res, next) => {
  const auth = getAuth(req)
  if (!auth.isAuthenticated) {
    res.status(401).end()
  } else {
    next()
  }
}
