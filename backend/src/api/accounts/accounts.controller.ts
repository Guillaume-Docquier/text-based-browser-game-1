import { type Result } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { type AccountsRepository } from "#api/accounts/accounts.repository.ts"
import { AccountId } from "#lib/db/accounts/AccountId.ts"

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
}

export type NewAccountDto = z.infer<typeof NewAccountDto>
export const NewAccountDto = z.object({
  authId: z.string(),
  email: z.string().nullish(),
  alias: z.string().nullish(),
})

export type AccountDto = z.infer<typeof AccountDto>
export const AccountDto = z.object({
  id: AccountId,
  authId: z.string(),
  email: z.string().nullable(),
  alias: z.string().nullable(),
})
