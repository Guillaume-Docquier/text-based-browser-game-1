import type { DeepUnbranded } from "@guillaume-docquier/tools-ts"
import type { z } from "zod"

/**
 * We use zod schemas on unknown inputs to parse & validate the data.
 * However, when you have already parsed data (usually because it is trusted data) and want to validate, using schema.parse is bad because the parameter is `unknown`, so you don't get feedback from TypeScript.
 *
 * Use this `typedParse` method instead, which accepts as input a strongly typed but unbranded version of the data and outputs a branded version of it, after validation.
 *
 * This is really just a schema.parse() with type safe inputs when you only need to run the validation part of the schema.
 *
 * @example
 * ```ts
 * typedParse(IntegerSchema, 42)   // ✓
 * typedParse(IntegerSchema, 42.5) // throws
 * typedParse(IntegerSchema, "42") // TS error
 * ```
 */
export function typedParse<TSchema extends z.ZodType>(schema: TSchema, value: DeepUnbranded<z.output<TSchema>>): z.output<TSchema> {
  return schema.parse(value)
}

/**
 * The safeParse counterpart to {@link typedParse}
 *
 * @example
 * ```ts
 * safeTypedParse(IntegerSchema, 42)   // ✓
 * safeTypedParse(IntegerSchema, 42.5) // returns success = false
 * safeTypedParse(IntegerSchema, "42") // TS error
 * ```
 */
export function safeTypedParse<TSchema extends z.ZodType>(
  schema: TSchema,
  value: DeepUnbranded<z.output<TSchema>>,
): z.ZodSafeParseResult<z.output<TSchema>> {
  return schema.safeParse(value)
}
