import { type Logger, Result, type Time, Timer } from "@guillaume-docquier/tools-ts"
import { initTRPC, TRPCError } from "@trpc/server"
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express"
import { getHTTPStatusCodeFromError } from "@trpc/server/http"
import type { MiddlewareResult } from "@trpc/server/unstable-core-do-not-import" // oops, lol
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
 * The response code and user message for a mapped API failure.
 */
export type TrpcErrorResponse = { code: TRPCError["code"]; message: string }

/**
 * Resolves an API Result into a tRPC output or mapped API error.
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

    const logEntry = createLogEntry(result, { startTime, route: path, type, requestId: ctx.requestId })
    logger[logEntry.level](logEntry.message, logEntry.context)

    return result
  })

  const privateProcedure = publicProcedure.use(async ({ next, ctx }) => {
    if (ctx.account === undefined) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "You must be authenticated to perform this operation." })
    }

    return await next({ ctx: { account: ctx.account } })
  })

  const inGameProcedure = privateProcedure
    .input(z.object({ gameId: GameIdSchema }))
    .use(async ({ input: { gameId }, ctx: { account }, next }) => {
      const playerIdResult = await gamesRepository.getPlayerId({ gameId, accountId: account.id })
      if (Result.isFailure(playerIdResult)) {
        logger.error("Failed to determine if player has joined the game.", { gameId, accountId: account.id, error: playerIdResult.error })
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Game membership could not be checked." })
      }

      if (playerIdResult.value === undefined) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You must join a game before you can participate in it." })
      }

      return await next({ ctx: { playerId: playerIdResult.value } })
    })

  return {
    router: t.router,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: Only exposed method types change; the native builder and inferred context are preserved.
    publicProcedure: publicProcedure as RequireProcedureSchemas<typeof publicProcedure>,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: Only exposed method types change; the native builder and inferred context are preserved.
    privateProcedure: privateProcedure as RequireProcedureSchemas<typeof privateProcedure>,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: Only exposed method types change; the native builder and inferred context are preserved.
    inGameProcedure: inGameProcedure as RequireProcedureSchemas<typeof inGameProcedure>,
  }
}

type LogContext =
  | {
      status: "success"
      durationMs: number
      route: string
      type: string
      requestId: string
    }
  | {
      status: "error"
      durationMs: number
      route: string
      type: string
      requestId: string
      trpcCode: string
      errorCode: string | undefined
    }

type LogEntry = {
  message: string
  level: "info" | "error"
  context: LogContext
}

const RPC_EVENT_COMPLETED = "rpc.event.completed"
function createLogEntry(
  result: MiddlewareResult<TrpcContext>,
  { startTime, route, type, requestId }: { startTime: Time; route: string; type: string; requestId: string },
): LogEntry {
  const durationMs = Timer.since(startTime).value

  if (!result.ok) {
    return {
      message: RPC_EVENT_COMPLETED,
      level: getHTTPStatusCodeFromError(result.error) >= 500 ? "error" : "info",
      context: {
        status: "error",
        durationMs,
        route,
        type,
        requestId,
        trpcCode: result.error.code,
        errorCode: result.error instanceof ApiTrpcError ? result.error.errorCode : undefined,
      },
    }
  }

  return {
    message: RPC_EVENT_COMPLETED,
    level: "info",
    context: {
      status: "success",
      durationMs,
      route,
      type,
      requestId,
    },
  }
}
