import { z } from "zod"
import { FinishOnboardingCommandSchema } from "#api/accounts/finishOnboarding.command.ts"
import { FinishOnboardingErrorResponses } from "#api/accounts/finishOnboarding.error.ts"
import type { FinishOnboardingUseCase } from "#api/accounts/finishOnboarding.useCase.ts"
import { NO_INPUT, NO_OUTPUT, type Trpc, toTrpcOutput } from "#api/trpc.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC inference do the work
export function createAccountsRouter({ trpc, finishOnboardingUseCase }: { trpc: Trpc; finishOnboardingUseCase: FinishOnboardingUseCase }) {
  return trpc.router({
    isOnboarded: trpc.privateProcedure
      .input(NO_INPUT)
      .output(z.boolean())
      .query(({ ctx: { account } }) => account.onboarded),

    finishOnboarding: trpc.privateProcedure
      .input(FinishOnboardingCommandSchema)
      .output(NO_OUTPUT)
      .mutation(
        async ({ input: finishOnboardingCommand, ctx: { account } }) =>
          await toTrpcOutput(
            finishOnboardingUseCase.execute(finishOnboardingCommand, { accountId: account.id }),
            FinishOnboardingErrorResponses,
          ),
      ),
  })
}
