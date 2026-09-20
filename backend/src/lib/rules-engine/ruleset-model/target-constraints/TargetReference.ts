import { branded } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import type { TargetRole } from "#lib/rules-engine/ruleset-model/mechanics/AbstractMechanic.ts"

/**
 * A reference to a target slot selected on an Action Submission.
 */
export type ActionTargetReference = Readonly<{
  type: "ACTION_TARGET"
  tag: string
}>

/**
 * A reference to a target supplied by another Mechanic in the same Action.
 */
export type MechanicTargetReference = Readonly<{
  type: "MECHANIC_TARGET"
  role: TargetRole
}>

/**
 * The target reference forms supported by target constraints.
 */
export type TargetReference = ActionTargetReference | MechanicTargetReference

/**
 * The runtime parser for a Mechanic target role.
 */
export const TargetRoleSchema = z.string().transform(branded<TargetRole>) satisfies z.ZodType<TargetRole>

/**
 * The runtime parser for an Action target reference.
 */
export const ActionTargetReferenceSchema = z
  .object({
    type: z.literal("ACTION_TARGET"),
    tag: z.string(),
  })
  .strict() satisfies z.ZodType<ActionTargetReference>

/**
 * The runtime parser for a Mechanic target reference.
 */
export const MechanicTargetReferenceSchema = z
  .object({
    type: z.literal("MECHANIC_TARGET"),
    role: TargetRoleSchema,
  })
  .strict() satisfies z.ZodType<MechanicTargetReference>

/**
 * The discriminated parser for all target references.
 */
export const TargetReferenceSchema = z.discriminatedUnion("type", [
  ActionTargetReferenceSchema,
  MechanicTargetReferenceSchema,
]) satisfies z.ZodType<TargetReference>

/**
 * Alias for callers that name references by their owning constraint model.
 */
export const TargetConstraintReferenceSchema = TargetReferenceSchema
