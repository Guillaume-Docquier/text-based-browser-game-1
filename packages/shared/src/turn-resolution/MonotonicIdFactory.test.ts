import { describe, it, expect } from "vitest"
import { MonotonicIdFactory } from "#shared/turn-resolution/MonotonicIdFactory.ts"

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
