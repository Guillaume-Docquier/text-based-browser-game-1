import type { Result } from "@guillaume-docquier/tools-ts"
import type { AccountId } from "shared/domain/accounts/AccountId.ts"
import type { Alias } from "shared/domain/accounts/Alias.ts"
import type { FinishOnboardingError } from "#api/accounts/finishOnboarding.error.ts"
import type { AccountsRepository } from "./accounts.repository.ts"

/**
 * Completes the authenticated account's onboarding.
 */
export class FinishOnboardingUseCase {
  private readonly accountsRepository: AccountsRepository

  public constructor({ accountsRepository }: { accountsRepository: AccountsRepository }) {
    this.accountsRepository = accountsRepository
  }

  public async execute({ accountId, alias }: { accountId: AccountId; alias: Alias }): Promise<Result<void, FinishOnboardingError>> {
    return await this.accountsRepository.finishOnboarding({ accountId, alias })
  }
}
