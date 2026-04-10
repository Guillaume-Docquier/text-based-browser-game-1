import type { Logger } from "@guillaume-docquier/tools-ts"
import type { PlayersRepository } from "#lib/db/players.repository.ts"
import type { GamesRepository } from "#lib/db/games.repository.ts"

const tick = 1

export async function processTick({
  logger,
  playersRepository,
  gamesRepository,
}: {
  logger: Logger
  playersRepository: PlayersRepository
  gamesRepository: GamesRepository
}): Promise<void> {
  const players = await playersRepository.findByAuthId({ authId: "blah" })
  const games = await gamesRepository.getSummaries()

  logger.info("Processing tick...", { tick, nbGames: games.length, nbPlayers: players?.alias ?? null })
}
