import { type Result } from "@guillaume-docquier/tools-ts"
import { type PlayerRow, type PlayerRowInsert, type PlayersRepository } from "#lib/db/players.repository.ts"
import z from "zod"

export class PlayersService {
  private readonly playersRepository: PlayersRepository

  public constructor({ playersRepository }: { playersRepository: PlayersRepository }) {
    this.playersRepository = playersRepository
  }

  /**
   * Creates a new player and returns the created player with its generated id.
   * If the creation fails, a Failure is return with a description.
   */
  public async create(newPlayer: PlayerInsert): Promise<Result<Player, string>> {
    return await this.playersRepository.insert(newPlayer)
  }

  /**
   * Gets a player by the auth id.
   * Returns undefined when no matching player was found.
   * Returns a Failure when an error prevented getting the user. The user might exist, but we couldn't retrieve it.
   */
  public async getByAuthId({ authId }: { authId: string }): Promise<Result<Player | undefined, string>> {
    return await this.playersRepository.getByAuthId({ authId })
  }
}

export type Player = z.infer<typeof Player>
export const Player = z.object({
  id: z.number(),
  clerk_id: z.string(),
  email: z.string().nullable(),
  alias: z.string().nullable(),
}) satisfies z.ZodType<PlayerRow>

export type PlayerInsert = z.infer<typeof PlayerInsert>
export const PlayerInsert = z.object({
  clerk_id: z.string(),
  email: z.string().nullable().optional(),
  alias: z.string().nullable().optional(),
}) satisfies z.ZodType<PlayerRowInsert>
