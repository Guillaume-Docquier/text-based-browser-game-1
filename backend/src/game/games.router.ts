import express, { type Router } from "express"
import type { AuthService } from "#auth/auth.service.ts"
import { type GamesController } from "./games.controller.ts"
import type { Logger } from "@guillaume-docquier/tools-ts"

/**
 * Import side effect free express router creator.
 * It receives all dependencies so we can easily mock them during tests.
 * It also decouples the router from those dependencies, if done well.
 */
export function createGamesRouter({
  gameController,
  logger,
}: {
  gameController: GamesController
  authService: AuthService
  logger: Logger
}): Router {
  const gamesRouterLogger = logger.child({ scope: "games-router" })
  const gamesRouter = express.Router()

  /**
   * Gets all games, and eventually will support queries (by name, by state, etc) and pagination
   */
  gamesRouter.get("/", async (req, res) => {
    const games = await gameController.getAll()

    gamesRouterLogger.info("GET games", { count: games.length })
    return res.send({ games })
  })

  /**
   * Gets a game by id
   */
  gamesRouter.get("/:id", async (req, res) => {
    const gameId = Number(req.query.id)
    const game = await gameController.findById({ gameId })

    gamesRouterLogger.info(`GET game ${gameId}`, { game })
    if (game === undefined) {
      return res.status(404)
    }

    return res.send({ game })
  })

  return gamesRouter
}
