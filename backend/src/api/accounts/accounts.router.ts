import { Assert, Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import type { Trpc } from "#api/trpc.ts"
import { FinishOnboardingDtoSchema, IsOnboardedDtoSchema, type AccountsController } from "./accounts.controller.ts"
import { FinishOnboardingError } from "./accounts.repository.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC inference do the work
export function createAccountsRouter({ trpc, accountsController }: { trpc: Trpc; accountsController: AccountsController }) {
  return trpc.router({
    isOnboarded: trpc.privateProcedure.output(IsOnboardedDtoSchema).query(({ ctx: { account } }) => account.onboarded),

    finishOnboarding: trpc.privateProcedure.input(FinishOnboardingDtoSchema).mutation(async ({ input: { alias }, ctx: { account } }) => {
      const finishOnboardingResult = await accountsController.finishOnboarding({ accountId: account.id, alias })
      if (Result.isSuccess(finishOnboardingResult)) {
        return
      }

      switch (finishOnboardingResult.error) {
        case FinishOnboardingError.ALREADY_ONBOARDED:
          throw new TRPCError({ code: "BAD_REQUEST", message: "Onboarding has already been completed." })
        case FinishOnboardingError.ALREADY_TAKEN:
          throw new TRPCError({ code: "CONFLICT", message: "That alias is already taken." })
        case FinishOnboardingError.COULD_NOT_FINISH:
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Onboarding could not be completed." })
        default:
          Assert.isExhausted(finishOnboardingResult.error)
      }
    }),
  })
}
