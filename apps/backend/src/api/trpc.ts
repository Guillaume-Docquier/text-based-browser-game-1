import { type Logger, Result, Timer } from "@guillaume-docquier/tools-ts"
import { initTRPC, TRPCError } from "@trpc/server"
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express"
import { getHTTPStatusCodeFromError } from "@trpc/server/http"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { v4 } from "uuid"
import { z } from "zod"
import type { GamesRepository } from "#api/games/games.repository.ts"
import type { RequireProcedureSchemas } from "#api/trpc.d.ts"

/**
 * Explicitly declare that a procedure accepts no input.
 */
export const NO_INPUT = z.void()

/**
 * Explicitly declare that a procedure returns no value.
 */
export const NO_OUTPUT = z.void()

/**
 * The response code and user message for a mapped use-case failure.
 */
export type TrpcErrorResponse = { code: TRPCError["code"]; message: string }

/**
 * Resolves a use-case Result into a tRPC output or mapped API error.
 */
export async function toTrpcOutput<TValue, TError extends string>(
  pendingResult: Promise<Result<TValue, TError>>,
  errorResponses: Record<NoInfer<TError>, TrpcErrorResponse>,
): Promise<TValue> {
  const result = await pendingResult
  if (Result.isFailure(result)) {
    throw new ApiTrpcError(errorResponses[result.error], result.error)
  }

  return result.value
}

class ApiTrpcError extends TRPCError {
  public readonly errorCode: string

  public constructor(response: TrpcErrorResponse, errorCode: string) {
    super(response)
    this.name = "ApiTrpcError"
    this.errorCode = errorCode
  }
}

type ExpressContextOptions = Pick<CreateExpressContextOptions, "req" | "res">

export type TrpcContext = ExpressContextOptions & { requestId: string }

export const createTrpcContext = ({ req, res }: ExpressContextOptions): TrpcContext => {
  return {
    req,
    res,
    requestId: v4(),
  }
}

export type Trpc = ReturnType<typeof createTrpc>
// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
export function createTrpc({ gamesRepository, logger: baseLogger }: { gamesRepository: GamesRepository; logger: Logger }) {
  const logger = baseLogger.child({ scope: "trpc" })
  // { isDev: false } disables stack traces, see https://trpc.io/docs/server/error-handling#stack-traces-in-production
  const t = initTRPC.context<TrpcContext>().create({ isDev: false })

  const publicProcedure = t.procedure.use(async ({ next, ctx, path, type }) => {
    const startTime = Timer.start()
    const result = await next({ ctx: { account: ctx.req.account } })
    const context = {
      durationMs: Timer.since(startTime).value,
      route: path,
      type,
      requestId: ctx.requestId,
    }

    if (result.ok) {
      logger.info("rpc.event.completed", { ...context, status: "success" })
    } else {
      const errorContext = {
        ...context,
        status: "error",
        trpcCode: result.error.code,
        ...(result.error instanceof ApiTrpcError ? { errorCode: result.error.errorCode } : {}),
      }
      if (getHTTPStatusCodeFromError(result.error) >= 500) {
        logger.error("rpc.event.completed", errorContext)
      } else {
        logger.info("rpc.event.completed", errorContext)
      }
    }

    return result
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
      const playerIdResult = await gamesRepository.getPlayerId({ gameId, accountId: account.id })
      if (Result.isFailure(playerIdResult)) {
        logger.error("Failed to determine if player has joined the game.", {
          gameId,
          accountId: account.id,
          error: playerIdResult.error,
        })
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Game membership could not be checked.",
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

  return {
    router: t.router,
    // SAFETY: Only exposed method types change; the native builder and inferred context are preserved.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: The schema-stage narrowing is verified by compile-time regression checks.
    publicProcedure: publicProcedure as RequireProcedureSchemas<typeof publicProcedure>,
    // SAFETY: Only exposed method types change; the native builder and authenticated context are preserved.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: The schema-stage narrowing is verified by compile-time regression checks.
    privateProcedure: privateProcedure as RequireProcedureSchemas<typeof privateProcedure>,
    // SAFETY: Only exposed method types change; the native builder, inherited game input, and player context are preserved.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: The schema-stage narrowing is verified by compile-time regression checks.
    inGameProcedure: inGameProcedure as RequireProcedureSchemas<typeof inGameProcedure>,
  }
}
