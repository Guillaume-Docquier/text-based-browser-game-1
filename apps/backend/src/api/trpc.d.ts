import type { Prettify } from "@guillaume-docquier/tools-ts"
import type { TRPCProcedureBuilder, TRPCUnsetMarker } from "@trpc/server"
import type { z } from "zod"
// Prettify intersects with {}, so apply it only to objects to preserve optional input unions.
type FlattenSchemaType<T> = T extends object ? Prettify<T> : T
type MergeSchemaTypes<TExisting, TAdded> = TExisting extends TRPCUnsetMarker ? TAdded : FlattenSchemaType<TExisting & TAdded>

// Preserve tRPC's object-input chaining rules, including required/optional compatibility.
type ChainedInputSchema<TExisting, TSchema extends z.ZodType> = TExisting extends TRPCUnsetMarker
  ? TSchema
  : z.output<TSchema> extends Record<string, unknown> | undefined
    ? TExisting extends Record<string, unknown> | undefined
      ? undefined extends z.output<TSchema>
        ? undefined extends TExisting
          ? TSchema
          : never
        : TSchema
      : never
    : never

/**
 * Require input and output schemas, in order, before exposing procedure resolvers.
 * Inherited inputs count; additional inputs are allowed only before output.
 */
export type RequireProcedureSchemas<TBuilder> =
  TBuilder extends TRPCProcedureBuilder<
    infer TContext,
    infer TMeta,
    infer TContextOverrides,
    infer TInputIn,
    infer TInputOut,
    infer TOutputIn,
    infer TOutputOut,
    infer TCaller
  >
    ? TOutputOut extends TRPCUnsetMarker
      ? {
          input: <TSchema extends z.ZodType>(
            schema: ChainedInputSchema<TInputOut, TSchema>,
          ) => RequireProcedureSchemas<
            TRPCProcedureBuilder<
              TContext,
              TMeta,
              TContextOverrides,
              MergeSchemaTypes<TInputIn, z.input<TSchema>>,
              MergeSchemaTypes<TInputOut, z.output<TSchema>>,
              TOutputIn,
              TOutputOut,
              TCaller
            >
          >
        } & (TInputOut extends TRPCUnsetMarker
          ? unknown
          : {
              output: <TSchema extends z.ZodType>(
                schema: TSchema,
              ) => Pick<
                TRPCProcedureBuilder<TContext, TMeta, TContextOverrides, TInputIn, TInputOut, z.input<TSchema>, z.output<TSchema>, TCaller>,
                "query" | "mutation" | "subscription"
              >
            })
      : Pick<TBuilder, "query" | "mutation" | "subscription">
    : never
