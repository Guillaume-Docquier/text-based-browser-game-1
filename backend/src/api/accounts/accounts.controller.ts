import { Result } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import type { AccountsRepository, SetAliasError } from "#api/accounts/accounts.repository.ts"
import { type AccountId, AccountIdSchema } from "#lib/db/accounts/AccountId.ts"

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
   * Sets the authenticated account's alias.
   */
  public async setAlias({ accountId, alias }: { accountId: AccountId; alias: string }): Promise<Result<CurrentAccountDto, SetAliasError>> {
    const setAliasResult = await this.accountsRepository.setAlias({ accountId, alias })
    if (Result.isFailure(setAliasResult)) {
      return setAliasResult
    }

    return Result.Success({ alias: setAliasResult.value.alias })
  }
}

export type NewAccountDto = z.infer<typeof NewAccountDtoSchema>
export const NewAccountDtoSchema = z.object({
  authId: z.string(),
  email: z.string().nullish(),
})

export type AccountDto = z.infer<typeof AccountDtoSchema>
export const AccountDtoSchema = z.object({
  id: AccountIdSchema,
  authId: z.string(),
  email: z.string().nullable(),
  alias: z.string().nullable(),
})

export type CurrentAccountDto = z.infer<typeof CurrentAccountDtoSchema>
export const CurrentAccountDtoSchema = AccountDtoSchema.pick({ alias: true })

export type SetAliasDto = z.infer<typeof SetAliasDtoSchema>
export const SetAliasDtoSchema = z.object({
  alias: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .refine((alias) => !alias.includes("\0"), { error: "Alias cannot contain null characters." }),
})
