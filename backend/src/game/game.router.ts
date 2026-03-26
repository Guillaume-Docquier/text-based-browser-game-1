import express, { type Router } from "express"
import type { AuthService } from "#auth/auth.service.ts"
import { type GameController } from "./game.controller.ts"

/**
 * Import side effect free express router creator.
 * It receives all dependencies so we can easily mock them during tests.
 * It also decouples the router from those dependencies, if done well.
 */
export function createGameRouter({ gameController, authService }: { gameController: GameController; authService: AuthService }): Router {
  const gameRouter = express.Router()

  gameRouter.get("/tick", async (req, res) => {
    const tick = await gameController.getTick()
    if (tick === undefined) {
      return res.status(500).send({ error: "Could not get tick" })
    }

    console.log("GET tick", { tick })
    return res.send({ tick })
  })

  gameRouter.post("/tick", authService.requiresAuth(), async (req, res) => {
    const tick = await gameController.incrementTick({ by: 1 })
    if (tick === undefined) {
      return res.status(500).send({ error: "Could not update tick" })
    }

    console.log("POST tick", { tick })
    return res.send({ tick })
  })

  return gameRouter
}
