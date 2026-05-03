import type { RequestHandler } from "express"
import type { Player } from "#api/players/players.controller.ts"
import { type IAuthService } from "./auth.service.ts"

export class AuthServiceMock implements IAuthService {
  public player: Player | undefined

  public constructor({ player }: { player?: Player } = {}) {
    this.player = player
  }

  public authenticationMiddlewares(): RequestHandler[] {
    return [
      (req, _res, next): void => {
        req.player = this.player
        next()
      },
    ]
  }
}
