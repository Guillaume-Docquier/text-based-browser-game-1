import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { initTRPC, TRPCError } from "@trpc/server"
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { z } from "zod"
import type { GameplayRepository } from "#api/gameplay/gameplay.repository.ts"

type ExpressContextOptions = Pick<CreateExpressContextOptions, "req" | "res">

export type TrpcContext = Awaited<ReturnType<typeof createTrpcContext>>
export const createTrpcContext = ({ req, res }: ExpressContextOptions): ExpressContextOptions => {
  return {
    req,
    res,
  }
}

export type Trpc = ReturnType<typeof createTrpc>
// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
export function createTrpc({ gameplayRepository, logger: baseLogger }: { gameplayRepository: GameplayRepository; logger: Logger }) {
  const logger = baseLogger.child({ scope: "trpc" })
  // { isDev: false } disables stack traces, see https://trpc.io/docs/server/error-handling#stack-traces-in-production
  const t = initTRPC.context<TrpcContext>().create({ isDev: false })

  const publicProcedure = t.procedure.use(async ({ next, ctx }) => {
    return await next({ ctx: { account: ctx.req.account } })
  })

  const privateProcedure = publicProcedure.use(async ({ next, ctx }) => {
    if (ctx.account === undefined) {
      throw new TRPCError({ code: "UNAUTHORIZED" })
    }

    return await next({ ctx: { account: ctx.account } })
  })

  const inGameProcedure = privateProcedure
    .input(z.object({ gameId: GameIdSchema }))
    .use(async ({ input: { gameId }, ctx: { account }, next }) => {
      const playerIdResult = await gameplayRepository.getPlayerId({ gameId, accountId: account.id })
      if (Result.isFailure(playerIdResult)) {
        logger.error("Failed to determine if player has joined the game.", {
          gameId,
          accountId: account.id,
          error: playerIdResult.error,
        })
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not allowed to participate in this game.",
        })
      }

      if (playerIdResult.value === undefined) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must join a game before you can participate in it.",
        })
      }

      return await next({
        ctx: {
          playerId: playerIdResult.value,
        },
      })
    })

  return { router: t.router, publicProcedure, privateProcedure, inGameProcedure }
}
