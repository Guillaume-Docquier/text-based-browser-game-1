import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { and, eq } from "drizzle-orm"
import type { Account } from "shared/domain/accounts/Account.ts"
import type { AccountId } from "shared/domain/accounts/AccountId.ts"
import type { Alias } from "shared/domain/accounts/Alias.ts"
import { FinishOnboardingError } from "#api/accounts/finishOnboarding.error.ts"
import { Postgres } from "#lib/db/drizzle/Postgres.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { accountsTable } from "#lib/db/schema.ts"
import { couldNot } from "#lib/errors.ts"

export class AccountsRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "accounts-repository" })
  }

  public async createAccount(newAccount: Account, db: PostgresRepository["db"] = this.db): Promise<Result<Account, string>> {
    const createAccountResult = await Result.tryCatch(async () => {
      const accounts = await db
        .insert(accountsTable)
        .values({
          id: newAccount.id,
          authId: newAccount.authId,
          alias: newAccount.alias,
          onboarded: newAccount.onboarded,
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

  public async getAccountByAuthId(
    { authId }: { authId: string },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<Account | undefined, string>> {
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

  public async finishOnboarding({
    accountId,
    alias,
  }: {
    accountId: AccountId
    alias: Alias
  }): Promise<Result<void, FinishOnboardingError>> {
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
      return Result.Failure(FinishOnboardingError.UNKNOWN)
    }

    if (finishOnboardingResult.value === undefined) {
      return Result.Failure(FinishOnboardingError.ALREADY_ONBOARDED)
    }

    return Result.Success(undefined)
  }
}
