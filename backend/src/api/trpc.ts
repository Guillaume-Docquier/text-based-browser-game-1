import { initTRPC, TRPCError } from "@trpc/server"
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express"

type ExpressContextOptions = Pick<CreateExpressContextOptions, "req" | "res">

export type TrpcContext = Awaited<ReturnType<typeof createTrpcContext>>
export const createTrpcContext = ({ req, res }: ExpressContextOptions): ExpressContextOptions => {
  return {
    req,
    res,
  }
}

export type Trpc = ReturnType<typeof createTrpc>
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Let trpc inference do the work
export function createTrpc() {
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

  return { router: t.router, publicProcedure, privateProcedure }
}
