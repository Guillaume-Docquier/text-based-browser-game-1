import { createDb, type Database } from "#lib/db/createDb.ts"
import { parseEnv } from "#lib/parseEnv.ts"
import { gamesTable, accountsTable } from "#lib/db/schema.ts"
import { input } from "@inquirer/prompts"
import { sql } from "drizzle-orm"
import { type Table } from "drizzle-orm/table"
import { Assert, type Logger, type Result } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { AccountsRepository, type NewAccountModel, type AccountModel } from "#api/accounts/accounts.repository.ts"
import { GamesController } from "#api/games/games.controller.ts"
import { GamesRepository } from "#lib/db/games/games.repository.ts"
import { configureLogger } from "#lib/configureLogger.ts"
import { GameSettingsRepository } from "#lib/db/games/gameSettings.repository.ts"
import { GameStatesRepository } from "#lib/db/gameStates.repository.ts"
import { GameTicksRepository } from "#lib/db/gameTicks.repository.ts"
import { GamePlayerResourcesRepository } from "#lib/db/resources/gamePlayerResources.repository.ts"
import { GameLobbiesRepository } from "#api/game-lobbies/gameLobbies.repository.ts"

const YES_I_KNOW = "yes i know"

const envSchema = z.object({
  /**
   * See the infra docker-compose file for the dev db url.
   * postgres://<user>:<pwd>@localhost:<port>/<db>
   */
  DATABASE_URL: z.string(),

  /**
   * Clerk id if adding yourself.
   */
  CLERK_ID: z.string().optional(),

  /**
   * User email if adding yourself.
   */
  USER_EMAIL: z.string().optional(),

  /**
   * User alias if adding yourself.
   */
  USER_ALIAS: z.string().optional(),
})

const env = parseEnv({ envSchema })
void main({
  connectionString: env.DATABASE_URL,
  user:
    env.CLERK_ID === undefined
      ? undefined
      : {
          clerkId: env.CLERK_ID,
          email: env.USER_EMAIL,
          alias: env.USER_ALIAS,
        },
})

type User = {
  clerkId: string
  email: string | undefined
  alias: string | undefined
}

/**
 * Populates the database with basic data.
 * This will first wipe the database.
 * You will be asked to confirm if you're seeding a database other than the localhost db, just in case.
 *
 * The db to seed is determined by the DATABASE_URL env var.
 */
async function main({ connectionString, user }: { connectionString: string; user: User | undefined }): Promise<void> {
  const logger = await configureLogger({ scope: "db-seed", nonBlocking: false })
  const host = getDbHost(connectionString)
  if (!(await confirmSeeding(host))) {
    logger.info("Saved your ass, lol.")
    return
  }

  logger.info(`Creating services`)
  const db = createDb({ databaseUrl: connectionString })
  const gamesRepository = new GamesRepository({ db, logger })
  const accountsRepository = new AccountsRepository({ db, logger })
  const gamesController = new GamesController({
    logger,
    gamesRepository,
    createTransaction: db.transaction.bind(db),
    gameSettingsRepository: new GameSettingsRepository({ db, logger }),
    gameLobbiesRepository: new GameLobbiesRepository({ db, logger }),
    gameStatesRepository: new GameStatesRepository({ db, logger }),
    gameTicksRepository: new GameTicksRepository({ db, logger }),
    gamePlayerResourcesRepository: new GamePlayerResourcesRepository({ db, logger }),
  })

  logger.info(`Seeding the '${host}' database with default values`)
  try {
    logger.info("")
    const accounts = await seedAccounts({ db, user, logger, accountsRepository })

    logger.info("")
    await seedGames({ db, accounts, logger, gamesController })

    logger.info("")
    logger.info("Seeding completed")
  } finally {
    await db.$client.end()
  }
}

function getDbHost(connectionString: string): string {
  const [_, hostPortDb] = connectionString.split("@")
  if (hostPortDb === undefined) {
    throw new Error("No db host found in connection string")
  }

  const [host] = hostPortDb.split(":")
  if (host === undefined) {
    throw new Error("No db host found in connection string")
  }

  return host
}

async function confirmSeeding(host: string): Promise<boolean> {
  if (isLocal(host)) {
    return true
  }

  const doYouKnow = await input({
    message: `You're about to seed the '${host}' database that is not local.\nType '${YES_I_KNOW}' if that's what you intended.\n`,
  })

  return doYouKnow === YES_I_KNOW
}

function isLocal(host: string): boolean {
  return host === "localhost"
}

async function resetTable(db: Database, table: Table): Promise<void> {
  await db.execute(sql`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`)
}

async function seedAccounts({
  db,
  user,
  accountsRepository,
  logger,
}: {
  db: Database
  user: User | undefined
  accountsRepository: AccountsRepository
  logger: Logger
}): Promise<AccountModel[]> {
  logger.info("Accounts")
  logger.info("├ Cleaning up the accounts")
  await resetTable(db, accountsTable)
  logger.info("├ Adding sample accounts")
  const newAccounts: NewAccountModel[] = [
    ...(user !== undefined ? [{ authId: user.clerkId, email: user.email, alias: user.alias }] : []),
    { authId: "fake1", email: "fake1@email.com", alias: "fake1 name" },
    { authId: "fake2", email: "fake2@email.com" },
    { authId: "fake3" },
  ]

  const accounts: AccountModel[] = []
  for (const newAccount of newAccounts) {
    accounts.push(assertSuccess(await accountsRepository.createAccount(newAccount)))
  }

  logger.info("└ Done")

  return accounts
}

async function seedGames({
  db,
  accounts,
  gamesController,
  logger,
}: {
  db: Database
  accounts: AccountModel[]
  gamesController: GamesController
  logger: Logger
}): Promise<void> {
  const [firstAccount, secondAccount, thirdAccount] = accounts
  Assert.isDefined(firstAccount)
  Assert.isDefined(secondAccount)
  Assert.isDefined(thirdAccount)

  logger.info("Games")
  logger.info("├ Cleaning up the games")
  await resetTable(db, gamesTable)
  logger.info("├ Adding default games")
  const insanelyFastGame = assertSuccess(
    await gamesController.createGame({
      createdByAccountId: firstAccount.id,
      settings: { name: "insanely fast game", nbSeats: 5, tickIntervalSeconds: 60 },
    }),
  )
  assertSuccess(
    await gamesController.createGame({
      createdByAccountId: secondAccount.id,
      settings: { name: "fast game", nbSeats: 10, tickIntervalSeconds: 7200 },
    }),
  )
  logger.info("├ Adding accounts to games")
  assertSuccess(await gamesController.joinGame({ gameId: insanelyFastGame.createdGameId, accountId: secondAccount.id }))
  assertSuccess(await gamesController.joinGame({ gameId: insanelyFastGame.createdGameId, accountId: thirdAccount.id }))
  logger.info("└ Done")
}

/**
 * Nothing throws for the application, but here if something goes wrong, we just want to abort loudly
 */
function assertSuccess<TSuccess>(result: Result<TSuccess, string>): TSuccess {
  Assert.isSuccess(result)
  return result.value
}
