import { Assert, Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { FinishOnboardingError } from "#api/accounts/finishOnboarding.error.ts"
import { FinishOnboardingRequestSchema } from "#api/accounts/finishOnboarding.request.ts"
import type { FinishOnboardingUseCase } from "#api/accounts/finishOnboarding.useCase.ts"
import type { Trpc } from "#api/trpc.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC inference do the work
export function createAccountsRouter({ trpc, finishOnboardingUseCase }: { trpc: Trpc; finishOnboardingUseCase: FinishOnboardingUseCase }) {
  return trpc.router({
    isOnboarded: trpc.privateProcedure.output(z.boolean()).query(({ ctx: { account } }) => account.onboarded),

    finishOnboarding: trpc.privateProcedure
      .input(FinishOnboardingRequestSchema)
      .mutation(async ({ input: { alias }, ctx: { account } }) => {
        const finishOnboardingResult = await finishOnboardingUseCase.execute({ accountId: account.id, alias })
        if (Result.isSuccess(finishOnboardingResult)) {
          return
        }

        switch (finishOnboardingResult.error) {
          case FinishOnboardingError.ALREADY_ONBOARDED:
            throw new TRPCError({ code: "BAD_REQUEST", message: "Onboarding has already been completed." })
          case FinishOnboardingError.ALIAS_ALREADY_TAKEN:
            throw new TRPCError({ code: "CONFLICT", message: "That alias is already taken." })
          case FinishOnboardingError.UNKNOWN:
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Onboarding could not be completed." })
          default:
            Assert.isExhausted(finishOnboardingResult.error)
        }
      }),
  })
}
