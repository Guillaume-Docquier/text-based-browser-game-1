import { Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import { EffectError } from "#shared/turn-resolution/effects/EffectError.ts"
import { EffectPool } from "#shared/turn-resolution/effects/EffectPool.ts"
import { AssaultEffect } from "#shared/turn-resolution/effects/implementations/AssaultEffect.ts"

describe("semantic resolution origins", () => {
  it("should groups reconstructed clones once while keeping later reuse separate", () => {
    // Arrange
    const action = createSubmittedActionStub()
    const clone = structuredClone(action)
    const first = new AssaultEffect(0, action)
    first.origin = { initiatingTurn: 4, submittedAction: action }
    const second = new AssaultEffect(1, clone)
    second.origin = { initiatingTurn: 4, submittedAction: clone }
    const reuse = new AssaultEffect(2, action)
    reuse.origin = { initiatingTurn: 7, submittedAction: action }
    const pool = new EffectPool([first, second, reuse])
    const outcome = { type: "RESOLVED", result: "literal outcome" } as const
    // Act
    const results = [first, second, reuse].map((effect) => pool.recordOutcomes(effect, [outcome]))
    // Assert
    expect(results).toStrictEqual([Result.Success(undefined), Result.Success(undefined), Result.Success(undefined)])
    expect(pool.isEmpty()).toBe(true)
    expect(pool.getOrigins()).toHaveLength(2)
    expect(pool.getOutcomes(clone, 4)).toStrictEqual([outcome, outcome])
    expect(pool.getOutcomes(clone, 7)).toStrictEqual([outcome])
  })

  it("should rejects conflicting selections sharing the same semantic origin", () => {
    // Arrange
    const action = createSubmittedActionStub()
    const conflicting = { ...structuredClone(action), selectedInputs: { strength: 99 } }
    const first = new AssaultEffect(0, action)
    first.origin = { initiatingTurn: 4, submittedAction: action }
    const second = new AssaultEffect(1, conflicting)
    second.origin = { initiatingTurn: 4, submittedAction: conflicting }
    const pool = new EffectPool([first, second])
    // Act
    const firstResult = pool.recordOutcomes(first, [])
    const conflict = pool.recordOutcomes(second, [])
    // Assert
    expect(firstResult).toStrictEqual(Result.Success(undefined))
    expect(conflict).toStrictEqual(Result.Failure(EffectError.Failed({ error: "Conflicting action resolution origin" })))
    expect(pool.getAll()).toStrictEqual([second])
    expect(pool.getOrigins()).toHaveLength(1)
  })
})
