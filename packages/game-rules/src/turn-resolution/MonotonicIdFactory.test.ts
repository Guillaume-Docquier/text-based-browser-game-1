import { MonotonicIdFactory } from "game-rules/turn-resolution/MonotonicIdFactory.ts"
import { describe, it, expect } from "vitest"

describe("MonotonicIdFactory", () => {
  it("should create ids in sequence", () => {
    // Arrange
    const monotonicIdFactory = MonotonicIdFactory.create()

    // Act
    const ids = [monotonicIdFactory(), monotonicIdFactory(), monotonicIdFactory()]

    // Assert
    expect(ids).toStrictEqual<typeof ids>([0, 1, 2])
  })
})
