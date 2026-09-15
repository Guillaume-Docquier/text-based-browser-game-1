import { Result } from "@guillaume-docquier/tools-ts"
import { TRPCError } from "@trpc/server"
import type { Trpc } from "#api/trpc.ts"
import { CurrentAccountDtoSchema, type AccountsController, SetAliasDtoSchema } from "./accounts.controller.ts"
import { SetAliasError } from "./accounts.repository.ts"

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tRPC inference do the work
export function createAccountsRouter({ trpc, accountsController }: { trpc: Trpc; accountsController: AccountsController }) {
  return trpc.router({
    getCurrent: trpc.privateProcedure.output(CurrentAccountDtoSchema).query(({ ctx: { account } }) => {
      return { alias: account.alias }
    }),

    setAlias: trpc.privateProcedure
      .input(SetAliasDtoSchema)
      .output(CurrentAccountDtoSchema)
      .mutation(async ({ input: { alias }, ctx: { account } }) => {
        const setAliasResult = await accountsController.setAlias({ accountId: account.id, alias })
        if (Result.isSuccess(setAliasResult)) {
          return setAliasResult.value
        }

        if (setAliasResult.error === SetAliasError.ALREADY_TAKEN) {
          throw new TRPCError({ code: "CONFLICT", message: "That alias is already taken." })
        }

        if (setAliasResult.error === SetAliasError.ALREADY_SET) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Alias has already been set." })
        }

        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Alias could not be set." })
      }),
  })
}
