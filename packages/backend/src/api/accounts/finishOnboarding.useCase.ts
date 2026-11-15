import type { Result } from "@guillaume-docquier/tools-ts"
import type { AccountId } from "shared/domain/accounts/AccountId.ts"
import type { FinishOnboardingCommand } from "#api/accounts/finishOnboarding.command.ts"
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

  public async execute(
    finishOnboardingCommand: FinishOnboardingCommand,
    { accountId }: { accountId: AccountId },
  ): Promise<Result<void, FinishOnboardingError>> {
    return await this.accountsRepository.finishOnboarding({ accountId, alias: finishOnboardingCommand.alias })
  }
}
