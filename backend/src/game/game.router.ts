import express, { type Router } from "express"
import { authApi } from "#auth/authApi.ts"
import { type GameController } from "./game.controller.ts"

export function createGameRouter({ gameController }: { gameController: GameController }): Router {
  const gameRouter = express.Router()

  gameRouter.get("/tick", async (req, res) => {
    const tick = await gameController.getTick()
    if (tick === undefined) {
      return res.status(500).send({ error: "Could not get tick" })
    }

    console.log("GET tick", { tick })
    return res.send({ tick })
  })

  gameRouter.post("/tick", authApi, async (req, res) => {
    const tick = await gameController.incrementTick({ by: 1 })
    if (tick === undefined) {
      return res.status(500).send({ error: "Could not update tick" })
    }

    console.log("POST tick", { tick })
    return res.send({ tick })
  })

  return gameRouter
}
