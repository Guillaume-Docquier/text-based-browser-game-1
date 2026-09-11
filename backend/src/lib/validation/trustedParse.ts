import type { z } from "zod"

/**
 * Use this when you have **trusted** inputs that you are parsing, usually because you want to brand them, but also because you want to run the validation logic that's not purely parsing.
 * This is safer than using `schema.parse()` directly because the schema will accept `unknown` inputs, so it's not type safe.
 *
 * @example
 * ```ts
 * brand(Integer, 42)   // ✓
 * brand(Integer, 42.5) // throws
 * brand(Integer, "42") // TS error
 * ```
 */
export function trustedParse<TSchema extends z.ZodType>(schema: TSchema, value: z.input<TSchema>): z.output<TSchema> {
  return schema.parse(value)
}

/**
 * The safeParse counterpart to {@link trustedParse}
 *
 * @example
 * ```ts
 * brand(Integer, 42)   // ✓
 * brand(Integer, 42.5) // returns success = false
 * brand(Integer, "42") // TS error
 * ```
 */
export function trustedSafeParse<TSchema extends z.ZodType>(
  schema: TSchema,
  value: z.input<TSchema>,
): z.ZodSafeParseResult<z.output<TSchema>> {
  return schema.safeParse(value)
}
