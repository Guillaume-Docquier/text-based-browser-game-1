import { Assert, type Logger, type Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { input } from "@inquirer/prompts"
import { sql } from "drizzle-orm"
import type { Table } from "drizzle-orm/table"
import { z } from "zod"
import { type AccountModel, AccountsRepository, type NewAccountModel } from "#api/accounts/accounts.repository.ts"
import { LobbiesController } from "#api/lobbies/lobbies.controller.ts"
import { LobbiesRepository } from "#api/lobbies/lobbies.repository.ts"
import { configureLogger } from "#lib/configureLogger.ts"
import { createCreateTransaction, createDb, type Database } from "#lib/db/createDb.ts"
import { accountsTable, gamesTable } from "#lib/db/schema.ts"
import { parseEnv } from "#lib/parseEnv.ts"
import { CoreRulesets } from "#lib/rulesets/CoreRulesets.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import { StandardRuleset } from "#lib/rulesets/standard/StandardRuleset.ts"

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

const env = parseEnv({ schema: envSchema })
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
  const accountsRepository = new AccountsRepository({ db, logger })
  const rulesetsRepository = new RulesetsRepository({ db, logger })
  const lobbiesController = new LobbiesController({
    logger,
    createTransaction: createCreateTransaction(db),
    lobbiesRepository: new LobbiesRepository({ db, logger }),
  })

  logger.info(`Seeding the '${host}' database with default values`)
  try {
    logger.info("")
    const accounts = await seedAccounts({ db, user, logger, accountsRepository })

    logger.info("")
    await seedRulesets({ rulesetsRepository, logger })

    logger.info("")
    await seedGames({ db, accounts, logger, lobbiesController })

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

async function seedRulesets({ rulesetsRepository, logger }: { rulesetsRepository: RulesetsRepository; logger: Logger }): Promise<void> {
  logger.info("Rulesets")
  logger.info("├ Upserting core rulesets")

  for (const ruleset of CoreRulesets) {
    logger.info(`├— ${ruleset.name}`)
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(ruleset))
  }

  logger.info("└ Done")
}

async function seedGames({
  db,
  accounts,
  lobbiesController,
  logger,
}: {
  db: Database
  accounts: AccountModel[]
  lobbiesController: LobbiesController
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
    await lobbiesController.createLobby({
      createdByAccountId: firstAccount.id,
      configuration: {
        name: "insanely fast game",
        nbSeats: 5,
        turnIntervalSeconds: 60,
        rulesetId: StandardRuleset.id,
      },
    }),
  )
  assertSuccess(
    await lobbiesController.createLobby({
      createdByAccountId: secondAccount.id,
      configuration: {
        name: "fast game",
        nbSeats: 10,
        turnIntervalSeconds: Time.in(Time.create(2, UnitOfTime.HOURS), UnitOfTime.SECONDS),
        rulesetId: StandardRuleset.id,
      },
    }),
  )
  logger.info("├ Adding accounts to games")
  assertSuccess(await lobbiesController.joinLobby({ gameId: insanelyFastGame.createdGameId, accountId: secondAccount.id }))
  assertSuccess(await lobbiesController.joinLobby({ gameId: insanelyFastGame.createdGameId, accountId: thirdAccount.id }))
  logger.info("└ Done")
}

/**
 * Nothing throws for the application, but here if something goes wrong, we just want to abort loudly
 */
function assertSuccess<TSuccess>(result: Result<TSuccess, string>): TSuccess {
  Assert.isSuccess(result)
  return result.value
}
