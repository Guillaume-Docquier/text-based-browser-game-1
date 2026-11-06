import { Result } from "@guillaume-docquier/tools-ts"
import { PlayerIdSchema } from "#shared/domain/players/PlayerId.ts"
import { FleetIdSchema } from "#shared/domain/world/fleets/FleetId.ts"
import { PlanetIdSchema } from "#shared/domain/world/planets/PlanetId.ts"
import type { CompilationIssue } from "../compiler/CompilationIssue.ts"
import type { TargetEntities, TargetKind, TargetRef, TargetRefs, TargetSlots, ResolvedTargets } from "../definitions/TargetSlots.ts"
import type { ExecutionState } from "./ExecutionContext.ts"

/**
 * Looks up the original domain entity in the declared target namespace.
 */
export function findTarget<K extends TargetKind>(kind: K, id: string, state: ExecutionState): TargetEntities[K] | undefined {
  const readers: { [P in TargetKind]: (value: string) => TargetEntities[P] | undefined } = {
    fleet: (value) => {
      const parsed = FleetIdSchema.safeParse(value)
      return parsed.success && Object.hasOwn(state.fleets, parsed.data) ? state.fleets[parsed.data] : undefined
    },
    planet: (value) => {
      const parsed = PlanetIdSchema.safeParse(value)
      return parsed.success && Object.hasOwn(state.planets, parsed.data) ? state.planets[parsed.data] : undefined
    },
    player: (value) => {
      const parsed = PlayerIdSchema.safeParse(value)
      return parsed.success && Object.hasOwn(state.players, parsed.data) ? state.players[parsed.data] : undefined
    },
  }
  return readers[kind](id)
}

/**
 * Resolves mechanic-local slots through validated action references.
 */
export function resolveTargets<T extends TargetSlots>(
  refs: TargetRefs<T>,
  selected: Readonly<Record<string, string>>,
  state: ExecutionState,
): Result<ResolvedTargets<T>, CompilationIssue[]> {
  const resolved: Record<string, TargetEntities[TargetKind]> = Object.create(null)
  const references: Readonly<Record<string, TargetRef>> = refs
  const issues: CompilationIssue[] = []
  for (const [slot, ref] of Object.entries(references)) {
    const id = Object.hasOwn(selected, ref.name) ? selected[ref.name] : undefined
    const entity = id === undefined ? undefined : findTarget(ref.kind, id, state)
    if (entity === undefined) {
      issues.push({ path: ["selectedTargets", ref.name], message: `Missing or unknown ${ref.kind} target` })
    } else {
      resolved[slot] = entity
    }
  }
  if (issues.length > 0) return Result.Failure(issues)
  // SAFETY: Every declared slot was resolved from the collection matching its
  // kind; any absent entity returned Failure above.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: All mapped slots and entity kinds were checked above.
  return Result.Success(resolved as ResolvedTargets<T>)
}
