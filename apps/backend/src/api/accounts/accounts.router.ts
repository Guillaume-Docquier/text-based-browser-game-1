import { Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { FinishOnboardingCommandSchema } from "#api/accounts/finishOnboarding.command.ts"
import { FinishOnboardingErrorResponses } from "#api/accounts/finishOnboarding.error.ts"
import type { FinishOnboardingUseCase } from "#api/accounts/finishOnboarding.useCase.ts"
import { NO_INPUT, NO_OUTPUT, type Trpc } from "#api/trpc.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC inference do the work
export function createAccountsRouter({ trpc, finishOnboardingUseCase }: { trpc: Trpc; finishOnboardingUseCase: FinishOnboardingUseCase }) {
  return trpc.router({
    /**
     * Returns whether the authenticated account has completed onboarding.
     * Use after signing in to decide whether to show the alias selection form.
     */
    isOnboarded: trpc.privateProcedure
      .input(NO_INPUT)
      .output(z.boolean())
      .query(({ ctx: { account } }) => account.onboarded),

    /**
     * Sets the authenticated account's unique alias and completes onboarding.
     * Use when submitting the alias selection form for an account that is not yet onboarded.
     */
    finishOnboarding: trpc.privateProcedure
      .input(FinishOnboardingCommandSchema)
      .output(NO_OUTPUT)
      .mutation(async ({ input: finishOnboardingCommand, ctx: { account } }) => {
        const finishOnboardingResult = await finishOnboardingUseCase.execute(finishOnboardingCommand, { accountId: account.id })
        if (Result.isFailure(finishOnboardingResult)) {
          throw new TRPCError(FinishOnboardingErrorResponses[finishOnboardingResult.error])
        }

        return finishOnboardingResult.value
      }),
  })
}
