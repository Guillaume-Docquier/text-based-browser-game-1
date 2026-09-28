import { Result } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import type { AccountsRepository, FinishOnboardingError } from "#api/accounts/accounts.repository.ts"
import { type AccountId, AccountIdSchema } from "#lib/db/accounts/AccountId.ts"
import { type Alias, AliasSchema } from "#lib/db/accounts/Alias.ts"

export class AccountsController {
  private readonly accountsRepository: AccountsRepository

  public constructor({ accountsRepository }: { accountsRepository: AccountsRepository }) {
    this.accountsRepository = accountsRepository
  }

  /**
   * Creates a new account and returns the created account with its generated id.
   * If the creation fails, a Failure is return with a description.
   */
  public async createAccount(newAccount: NewAccountDto): Promise<Result<AccountDto, string>> {
    return await this.accountsRepository.createAccount(newAccount)
  }

  /**
   * Gets an account by the auth id.
   * Returns undefined when no matching account was found.
   * Returns a Failure when an error prevented getting the account. The account might exist, but we couldn't retrieve it.
   */
  public async getAccountByAuthId({ authId }: { authId: string }): Promise<Result<AccountDto | undefined, string>> {
    return await this.accountsRepository.getAccountByAuthId({ authId })
  }

  /**
   * Completes the authenticated account's onboarding.
   */
  public async finishOnboarding({
    accountId,
    alias,
  }: {
    accountId: AccountId
    alias: Alias
  }): Promise<Result<void, FinishOnboardingError>> {
    const finishOnboardingResult = await this.accountsRepository.finishOnboarding({ accountId, alias })
    if (Result.isFailure(finishOnboardingResult)) {
      return finishOnboardingResult
    }

    return Result.Success(undefined)
  }
}

export type NewAccountDto = z.infer<typeof NewAccountDtoSchema>
export const NewAccountDtoSchema = z.object({
  authId: z.string(),
  email: z.string().nullish(),
  alias: AliasSchema,
  onboarded: z.boolean(),
})

export type AccountDto = z.infer<typeof AccountDtoSchema>
export const AccountDtoSchema = z.object({
  id: AccountIdSchema,
  authId: z.string(),
  email: z.string().nullable(),
  alias: AliasSchema,
  onboarded: z.boolean(),
})

export const IsOnboardedDtoSchema = z.boolean()
export const FinishOnboardingDtoSchema = z.object({ alias: AliasSchema })
