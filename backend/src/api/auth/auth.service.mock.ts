import type { RequestHandler } from "express"
import type { Player, PlayersController } from "#api/players/players.controller.ts"
import { type IAuthService } from "./auth.service.ts"

export class AuthServiceMock implements IAuthService {
  public player: Player | undefined

  public constructor(currentPlayer?: Player) {
    this.player = currentPlayer
  }

  public authenticationMiddlewares({ playersController: _playersController }: { playersController: PlayersController }): RequestHandler[] {
    return [
      (req, _res, next): void => {
        req.player = this.player
        next()
      },
    ]
  }
}
