import type { initTRPC, inferProcedureInput, inferProcedureOutput } from "@trpc/server"
import type { Account } from "shared/domain/accounts/Account.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { describe, expectTypeOf, test } from "vitest"
import { z } from "zod"
import { NO_INPUT, NO_OUTPUT, type Trpc } from "#api/trpc.ts"

// Vitest analyzes type tests without executing them, so declarations and invalid calls are safe here.
declare const trpc: Trpc
declare const nativeTrpc: ReturnType<typeof initTRPC.create>
type NoValue = ReturnType<() => void>

describe("tRPC procedure schemas", () => {
  test("preserves no-input and no-output contracts and public context", () => {
    const noValue = trpc.publicProcedure
      .input(NO_INPUT)
      .output(NO_OUTPUT)
      .mutation(({ input, ctx }) => {
        expectTypeOf(input).toEqualTypeOf<NoValue>()
        expectTypeOf(ctx.account).toEqualTypeOf<Account | undefined>()
      })
    expectTypeOf<inferProcedureInput<typeof noValue>>().toEqualTypeOf<NoValue>()
    expectTypeOf<inferProcedureOutput<typeof noValue>>().toEqualTypeOf<NoValue>()
  })

  test("preserves schema transformations and authenticated context", () => {
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
  })

  test("counts inherited game input and preserves player context", () => {
    const inheritedInput = trpc.inGameProcedure.output(NO_OUTPUT).mutation(({ input, ctx }) => {
      expectTypeOf(input).toEqualTypeOf<{ gameId: GameId }>()
      expectTypeOf(ctx.account).toEqualTypeOf<Account>()
      expectTypeOf(ctx.playerId).toEqualTypeOf<PlayerId>()
    })
    expectTypeOf<inferProcedureInput<typeof inheritedInput>>().toEqualTypeOf<{ gameId: number }>()
    expectTypeOf<inferProcedureOutput<typeof inheritedInput>>().toEqualTypeOf<NoValue>()
  })

  test("allows additional object inputs before output", () => {
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
  })

  test("preserves native optional-input caller compatibility", () => {
    const optionalInput = trpc.publicProcedure
      .input(z.object({ first: z.string() }).optional())
      .input(z.object({ second: z.boolean() }).optional())
      .output(z.boolean())
      .query(({ input }) => {
        expectTypeOf(input).toEqualTypeOf<{ first: string; second: boolean } | undefined>()
        return input?.second ?? false
      })
    const nativeOptionalInput = nativeTrpc.procedure
      .input(z.object({ first: z.string() }).optional())
      .input(z.object({ second: z.boolean() }).optional())
      .output(z.boolean())
      .query(() => false)
    // Optional callers include void in native tRPC; preserve that complete contract.
    expectTypeOf<inferProcedureInput<typeof optionalInput>>().toEqualTypeOf<inferProcedureInput<typeof nativeOptionalInput>>()
  })

  test("requires input before output on public and private procedures", () => {
    // @ts-expect-error Public procedures require an input before their output.
    trpc.publicProcedure.output(z.boolean())
    // @ts-expect-error Private procedures require an input before their output.
    trpc.privateProcedure.output(z.boolean())
  })

  test("requires both schemas before queries, mutations, and subscriptions", () => {
    // @ts-expect-error Queries require both schemas.
    trpc.publicProcedure.query(() => true)
    // @ts-expect-error Mutations require both schemas.
    trpc.privateProcedure.mutation(() => {})
    // @ts-expect-error Subscriptions require both schemas.
    trpc.publicProcedure.subscription(async function* () {
      yield 1
    })
  })

  test("requires output after input before exposing any resolver", () => {
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
  })

  test("does not allow additional schemas after output", () => {
    // @ts-expect-error Inputs cannot be added after output.
    trpc.publicProcedure.input(NO_INPUT).output(NO_OUTPUT).input(NO_INPUT)
    // @ts-expect-error Outputs cannot be replaced after entering the resolver stage.
    trpc.privateProcedure.input(NO_INPUT).output(NO_OUTPUT).output(NO_OUTPUT)
  })

  test("does not expose unrestricted builders through middleware or concatenation", () => {
    // @ts-expect-error Middleware cannot expose an unrestricted builder.
    trpc.publicProcedure.use(({ next }) => next())
    // @ts-expect-error Middleware cannot bypass the output requirement after input.
    trpc.privateProcedure.input(NO_INPUT).use(({ next }) => next())
    // @ts-expect-error Concatenation cannot expose an unrestricted builder.
    trpc.privateProcedure.concat(trpc.publicProcedure)
  })

  test("preserves required object-input chaining constraints", () => {
    // @ts-expect-error Inherited input cannot become optional.
    trpc.inGameProcedure.input(z.object({ ready: z.boolean() }).optional())
    // @ts-expect-error Additional inputs must be objects.
    trpc.inGameProcedure.input(z.string())
    // @ts-expect-error The inherited game input is required, so NO_INPUT is invalid here.
    trpc.inGameProcedure.input(NO_INPUT)
  })

  test("requires resolver output to match the output schema", () => {
    trpc.publicProcedure
      .input(NO_INPUT)
      .output(z.number())
      // @ts-expect-error Resolvers must return the output schema's input type.
      .query(() => "wrong")
  })
})
