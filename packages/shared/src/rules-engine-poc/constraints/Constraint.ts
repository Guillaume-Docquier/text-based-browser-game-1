import { NonNegativeNumberSchema, PositiveNumberSchema } from "@guillaume-docquier/tools-ts/schemas"
import { z } from "zod"
import type { CompatibleNames, TargetRef, TargetSlots } from "../definitions/TargetSlots.ts"

/**
 * Serializable predicates. Authors may add constraints, never executable code.
 */
export const ConstraintSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("ownedByActor"), target: z.string() }),
  z.strictObject({ kind: z.literal("strengthAtLeast"), fleet: z.string(), value: NonNegativeNumberSchema }),
  z.strictObject({ kind: z.literal("different"), a: z.string(), b: z.string() }),
  z.strictObject({ kind: z.literal("inRange"), fleet: z.string(), planet: z.string(), range: PositiveNumberSchema }),
])
export type ConstraintDefinition = z.input<typeof ConstraintSchema>
export type ParsedConstraint = z.output<typeof ConstraintSchema>
/**
 * Typed engine requirements prevent mixing entity kinds in predicates.
 */
export type Constraint =
  | { readonly kind: "ownedByActor"; readonly target: TargetRef<"fleet" | "planet"> }
  | { readonly kind: "strengthAtLeast"; readonly fleet: TargetRef<"fleet">; readonly value: number }
  | { readonly kind: "different"; readonly a: TargetRef; readonly b: TargetRef }
  | { readonly kind: "inRange"; readonly fleet: TargetRef<"fleet">; readonly planet: TargetRef<"planet">; readonly range: number }
/**
 * TypeScript authoring counterpart of runtime constraint checks.
 */
export type ActionConstraint<T extends TargetSlots> =
  | { readonly kind: "ownedByActor"; readonly target: CompatibleNames<T, "fleet" | "planet"> }
  | { readonly kind: "strengthAtLeast"; readonly fleet: CompatibleNames<T, "fleet">; readonly value: number }
  | { readonly kind: "different"; readonly a: keyof T; readonly b: keyof T }
  | {
      readonly kind: "inRange"
      readonly fleet: CompatibleNames<T, "fleet">
      readonly planet: CompatibleNames<T, "planet">
      readonly range: number
    }
