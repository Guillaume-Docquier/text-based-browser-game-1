import type { CreateExpressContextOptions } from "@trpc/server/adapters/express"
import { initTRPC } from "@trpc/server"

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
  const t = initTRPC.context<TrpcContext>().create()
  const publicProcedure = t.procedure

  return { t, publicProcedure }
}
