import { Assert, type Logger, Result, type Enumify } from "@guillaume-docquier/tools-ts"
import { and, eq } from "drizzle-orm"
import type { AccountId } from "#lib/db/accounts/AccountId.ts"
import type { Alias } from "#lib/db/accounts/Alias.ts"
import { Postgres } from "#lib/db/drizzle/Postgres.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { accountsTable } from "#lib/db/schema.ts"
import { couldNot } from "#lib/errors.ts"

type NewAccountRow = typeof accountsTable.$inferInsert

export type NewAccountModel = {
  id?: AccountId | undefined
  authId: string
  email?: string | null | undefined
  alias: Alias
  onboarded: boolean
}
export type AccountModel = {
  id: AccountId
  authId: string
  email: string | null
  alias: Alias
  onboarded: boolean
}

export type FinishOnboardingError = Enumify<typeof FinishOnboardingError>
export const FinishOnboardingError = {
  ALREADY_ONBOARDED: "ALREADY_ONBOARDED",
  ALIAS_ALREADY_TAKEN: "ALIAS_ALREADY_TAKEN",
  COULD_NOT_FINISH: "COULD_NOT_FINISH",
} as const

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
  public async createAccount(
    newAccountModel: NewAccountModel,
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<AccountModel, string>> {
    const createAccountResult = await Result.tryCatch(async () => {
      const accounts = await db.insert(accountsTable).values(toNewAccountRow(newAccountModel)).returning()
      Assert.isTrue(accounts.length === 1)
      Assert.isDefined(accounts[0])

      return accounts[0]
    })

    if (Result.isFailure(createAccountResult)) {
      this.logger.error("Could not create account", { newAccount: newAccountModel, error: createAccountResult.error })
      return Result.Failure(couldNot("create account"))
    }

    return createAccountResult
  }

  /**
   * Gets an account by the auth id.
   * Returns undefined when no matching account was found.
   * Returns a Failure when an error prevented getting the account. The account might exist, but we couldn't retrieve it.
   */
  public async getAccountByAuthId(
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

  /**
   * Completes an account's onboarding exactly once.
   */
  public async finishOnboarding({
    accountId,
    alias,
  }: {
    accountId: AccountId
    alias: Alias
  }): Promise<Result<AccountModel, FinishOnboardingError>> {
    const finishOnboardingResult = await Result.tryCatch(async () => {
      const accounts = await this.db
        .update(accountsTable)
        .set({ alias, onboarded: true })
        .where(and(eq(accountsTable.id, accountId), eq(accountsTable.onboarded, false)))
        .returning()
      Assert.isTrue(accounts.length <= 1)

      return accounts[0]
    })

    if (Result.isFailure(finishOnboardingResult)) {
      if (Postgres.isErrorWithCode(finishOnboardingResult.error, Postgres.ErrorCode.UNIQUE_VIOLATION)) {
        return Result.Failure(FinishOnboardingError.ALIAS_ALREADY_TAKEN)
      }

      this.logger.error("Could not finish account onboarding", { accountId, error: finishOnboardingResult.error })
      return Result.Failure(FinishOnboardingError.COULD_NOT_FINISH)
    }

    if (finishOnboardingResult.value === undefined) {
      return Result.Failure(FinishOnboardingError.ALREADY_ONBOARDED)
    }

    return Result.Success(finishOnboardingResult.value)
  }
}

function toNewAccountRow(newAccountModel: NewAccountModel): NewAccountRow {
  return {
    id: newAccountModel.id,
    authId: newAccountModel.authId,
    alias: newAccountModel.alias,
    onboarded: newAccountModel.onboarded,
    email: newAccountModel.email?.toLowerCase(),
  }
}
