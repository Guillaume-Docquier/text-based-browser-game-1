import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { accountsTable } from "#lib/db/schema.ts"
import { eq } from "drizzle-orm"
import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { couldNot } from "#lib/errors.ts"

type NewAccountRow = typeof accountsTable.$inferInsert
type AccountRow = typeof accountsTable.$inferSelect

export type NewAccountModel = NewAccountRow
export type AccountModel = AccountRow

export class AccountsRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "accounts-repository" })
  }

  /**
   * Creates a new account and returns the created account with its generated id.
   * If the creation fails, a Failure is returned with a reason.
   */
  public async create(newAccount: NewAccountModel, db: PostgresRepository["db"] = this.db): Promise<Result<AccountModel, string>> {
    const createAccountResult = await Result.tryCatch(async () => {
      const accounts = await db
        .insert(accountsTable)
        .values({
          ...newAccount,
          email: newAccount.email?.toLowerCase(),
        })
        .returning()
      Assert.isTrue(accounts.length === 1)
      Assert.isDefined(accounts[0])

      return accounts[0]
    })

    if (Result.isFailure(createAccountResult)) {
      this.logger.error("Could not create account", { newAccount, error: createAccountResult.error })
      return Result.Failure(couldNot("create account"))
    }

    return createAccountResult
  }

  /**
   * Gets an account by the auth id.
   * Returns undefined when no matching account was found.
   * Returns a Failure when an error prevented getting the account. The account might exist, but we couldn't retrieve it.
   */
  public async getByAuthId(
    { authId }: { authId: string },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<AccountModel | undefined, string>> {
    const findByAuthIdResult = await Result.tryCatch(async () => {
      const accounts = await db.select().from(accountsTable).where(eq(accountsTable.authId, authId))
      Assert.isTrue(accounts.length <= 1)

      return accounts[0]
    })

    if (Result.isFailure(findByAuthIdResult)) {
      this.logger.error("Could not get account by auth id", { authId, error: findByAuthIdResult.error })
      return Result.Failure(couldNot("get account by auth id"))
    }

    return findByAuthIdResult
  }
}
