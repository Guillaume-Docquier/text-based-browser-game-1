import type { z } from "zod"

/**
 * Use this when you have **trusted** inputs that you are trying to brand.
 * This is safer than using `schema.parse()` directly because the schema will accept `unknown` inputs, so it's not type safe.
 *
 * @example
 * ```ts
 * brand(Integer, 42)   // ✓
 * brand(Integer, 42.5) // throws
 * brand(Integer, "42") // TS error
 * ```
 */
export function brand<TSchema extends z.ZodType>(schema: TSchema, value: z.input<TSchema>): z.output<TSchema> {
  return schema.parse(value)
}

/**
 * The safeParse counterpart to {@link brand}
 *
 * @example
 * ```ts
 * brand(Integer, 42)   // ✓
 * brand(Integer, 42.5) // returns success = false
 * brand(Integer, "42") // TS error
 * ```
 */
export function safeBrand<TSchema extends z.ZodType>(schema: TSchema, value: z.input<TSchema>): z.ZodSafeParseResult<z.output<TSchema>> {
  return schema.safeParse(value)
}
