import type { initTRPC, inferProcedureInput, inferProcedureOutput } from "@trpc/server"
import type { Account } from "shared/domain/accounts/Account.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { expectTypeOf } from "vitest"
import { z } from "zod"
import { NO_INPUT, NO_OUTPUT, type Trpc } from "#api/trpc.ts"

// Compile-only regression checks, included in the backend's normal TypeScript check.
// This file is not executed: the deliberately invalid calls must remain type errors.
declare const trpc: Trpc
type NoValue = ReturnType<() => void>

const noValue = trpc.publicProcedure
  .input(NO_INPUT)
  .output(NO_OUTPUT)
  .mutation(({ input, ctx }) => {
    expectTypeOf(input).toEqualTypeOf<NoValue>()
    expectTypeOf(ctx.account).toEqualTypeOf<Account | undefined>()
  })
expectTypeOf<inferProcedureInput<typeof noValue>>().toEqualTypeOf<NoValue>()
expectTypeOf<inferProcedureOutput<typeof noValue>>().toEqualTypeOf<NoValue>()

const transformed = trpc.privateProcedure
  .input(z.string().transform(Number))
  .output(z.number().transform(String))
  .query(({ input, ctx }) => {
    expectTypeOf(input).toEqualTypeOf<number>()
    expectTypeOf(ctx.account).toEqualTypeOf<Account>()
    return input
  })
expectTypeOf<inferProcedureInput<typeof transformed>>().toEqualTypeOf<string>()
expectTypeOf<inferProcedureOutput<typeof transformed>>().toEqualTypeOf<string>()

const inheritedInput = trpc.inGameProcedure.output(NO_OUTPUT).mutation(({ input, ctx }) => {
  expectTypeOf(input).toEqualTypeOf<{ gameId: GameId }>()
  expectTypeOf(ctx.account).toEqualTypeOf<Account>()
  expectTypeOf(ctx.playerId).toEqualTypeOf<PlayerId>()
})
expectTypeOf<inferProcedureInput<typeof inheritedInput>>().toEqualTypeOf<{ gameId: number }>()
expectTypeOf<inferProcedureOutput<typeof inheritedInput>>().toEqualTypeOf<NoValue>()

const extendedInput = trpc.inGameProcedure
  .input(z.object({ ready: z.boolean() }))
  .output(z.boolean())
  .mutation(({ input, ctx }) => {
    expectTypeOf(input).toEqualTypeOf<{ gameId: GameId; ready: boolean }>()
    expectTypeOf(ctx.playerId).toEqualTypeOf<PlayerId>()
    return input.ready
  })
expectTypeOf<inferProcedureInput<typeof extendedInput>>().toEqualTypeOf<{ gameId: number; ready: boolean }>()
expectTypeOf<inferProcedureOutput<typeof extendedInput>>().toEqualTypeOf<boolean>()

const optionalInput = trpc.publicProcedure
  .input(z.object({ first: z.string() }).optional())
  .input(z.object({ second: z.boolean() }).optional())
  .output(z.boolean())
  .query(({ input }) => {
    expectTypeOf(input).toEqualTypeOf<{ first: string; second: boolean } | undefined>()
    return input?.second ?? false
  })
declare const nativeTrpc: ReturnType<typeof initTRPC.create>
const nativeOptionalInput = nativeTrpc.procedure
  .input(z.object({ first: z.string() }).optional())
  .input(z.object({ second: z.boolean() }).optional())
  .output(z.boolean())
  .query(() => false)
// Optional callers include void in native tRPC; preserve that complete contract.
expectTypeOf<inferProcedureInput<typeof optionalInput>>().toEqualTypeOf<inferProcedureInput<typeof nativeOptionalInput>>()
// @ts-expect-error Public procedures require an input before their output.
trpc.publicProcedure.output(z.boolean())
// @ts-expect-error Private procedures require an input before their output.
trpc.privateProcedure.output(z.boolean())
// @ts-expect-error Queries require both schemas.
trpc.publicProcedure.query(() => true)
// @ts-expect-error Mutations require both schemas.
trpc.privateProcedure.mutation(() => {})
// @ts-expect-error Subscriptions require both schemas.
trpc.publicProcedure.subscription(async function* () {
  yield 1
})
// @ts-expect-error An input alone does not allow a resolver.
trpc.publicProcedure.input(NO_INPUT).query(() => true)
// @ts-expect-error An input alone does not allow a mutation.
trpc.privateProcedure.input(NO_INPUT).mutation(() => {})
// @ts-expect-error An input alone does not allow a subscription.
trpc.publicProcedure.input(NO_INPUT).subscription(async function* () {
  yield 1
})
// @ts-expect-error Inherited input still requires an output.
trpc.inGameProcedure.mutation(() => {})
// @ts-expect-error Inputs cannot be added after output.
trpc.publicProcedure.input(NO_INPUT).output(NO_OUTPUT).input(NO_INPUT)
// @ts-expect-error Outputs cannot be replaced after entering the resolver stage.
trpc.privateProcedure.input(NO_INPUT).output(NO_OUTPUT).output(NO_OUTPUT)
// @ts-expect-error Middleware cannot expose an unrestricted builder.
trpc.publicProcedure.use(({ next }) => next())
// @ts-expect-error Middleware cannot bypass the output requirement after input.
trpc.privateProcedure.input(NO_INPUT).use(({ next }) => next())
// @ts-expect-error Concatenation cannot expose an unrestricted builder.
trpc.privateProcedure.concat(trpc.publicProcedure)
// @ts-expect-error Inherited input cannot become optional.
trpc.inGameProcedure.input(z.object({ ready: z.boolean() }).optional())
// @ts-expect-error Additional inputs must be objects.
trpc.inGameProcedure.input(z.string())
// @ts-expect-error The inherited game input is required, so NO_INPUT is invalid here.
trpc.inGameProcedure.input(NO_INPUT)
trpc.publicProcedure
  .input(NO_INPUT)
  .output(z.number())
  // @ts-expect-error Resolvers must return the output schema's input type.
  .query(() => "wrong")
