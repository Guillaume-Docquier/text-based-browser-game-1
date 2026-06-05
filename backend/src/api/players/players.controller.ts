import { type Result } from "@guillaume-docquier/tools-ts"
import { type PlayersRepository } from "#lib/db/players/players.repository.ts"
import z from "zod"

export class PlayersController {
  private readonly playersRepository: PlayersRepository

  public constructor({ playersRepository }: { playersRepository: PlayersRepository }) {
    this.playersRepository = playersRepository
  }

  /**
   * Creates a new player and returns the created player with its generated id.
   * If the creation fails, a Failure is return with a description.
   */
  public async create(newPlayer: NewPlayerDto): Promise<Result<PlayerDto, string>> {
    return await this.playersRepository.create(newPlayer)
  }

  /**
   * Gets a player by the auth id.
   * Returns undefined when no matching player was found.
   * Returns a Failure when an error prevented getting the user. The user might exist, but we couldn't retrieve it.
   */
  public async getByAuthId({ authId }: { authId: string }): Promise<Result<PlayerDto | undefined, string>> {
    return await this.playersRepository.getByAuthId({ authId })
  }
}

export type PlayerDto = z.infer<typeof PlayerDto>
export const PlayerDto = z.object({
  id: z.number(),
  clerk_id: z.string(),
  email: z.string().nullable(),
  alias: z.string().nullable(),
})

export type NewPlayerDto = z.infer<typeof NewPlayerDto>
export const NewPlayerDto = z.object({
  clerk_id: z.string(),
  email: z.string().nullable().optional(),
  alias: z.string().nullable().optional(),
})
