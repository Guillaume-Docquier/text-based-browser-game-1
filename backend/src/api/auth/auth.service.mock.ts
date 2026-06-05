import type { RequestHandler } from "express"
import type { PlayerDto } from "#api/players/players.controller.ts"
import { type IAuthService } from "./auth.service.ts"

export class AuthServiceMock implements IAuthService {
  public player: PlayerDto | undefined

  public constructor({ player }: { player?: PlayerDto } = {}) {
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
