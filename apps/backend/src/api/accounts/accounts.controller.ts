import { Result } from "@guillaume-docquier/tools-ts"
import type { AccountId } from "shared/domain/identity/AccountId.ts"
import { type Alias, AliasSchema } from "shared/domain/identity/Alias.ts"
import { z } from "zod"
import type { AccountsRepository, FinishOnboardingError } from "#api/accounts/accounts.repository.ts"

export class AccountsController {
  private readonly accountsRepository: AccountsRepository

  public constructor({ accountsRepository }: { accountsRepository: AccountsRepository }) {
    this.accountsRepository = accountsRepository
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

export const IsOnboardedDtoSchema = z.boolean()
export const FinishOnboardingDtoSchema = z.object({ alias: AliasSchema })
