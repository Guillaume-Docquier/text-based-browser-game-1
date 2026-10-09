import { Result } from "@guillaume-docquier/tools-ts"
import type { AccountId } from "shared/domain/accounts/AccountId.ts"
import { type Alias, AliasSchema } from "shared/domain/accounts/Alias.ts"
import { z } from "zod"
import type { AccountsRepository, FinishOnboardingError } from "./accounts.repository.ts"

/**
 * Completes the authenticated account's onboarding.
 */
export class FinishOnboardingUseCase {
  private readonly accountsRepository: AccountsRepository

  public constructor({ accountsRepository }: { accountsRepository: AccountsRepository }) {
    this.accountsRepository = accountsRepository
  }

  public async execute({ accountId, alias }: { accountId: AccountId; alias: Alias }): Promise<Result<void, FinishOnboardingError>> {
    const finishOnboardingResult = await this.accountsRepository.finishOnboarding({ accountId, alias })
    if (Result.isFailure(finishOnboardingResult)) {
      return finishOnboardingResult
    }

    return Result.Success(undefined)
  }
}

export const FinishOnboardingRequestSchema = z.object({ alias: AliasSchema })
