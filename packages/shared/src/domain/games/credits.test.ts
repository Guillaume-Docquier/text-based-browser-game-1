import { describe, expect, it } from "vitest"
import { addCredits, availableCredits, canAfford, creditDigits } from "./credits.ts"
describe("credit reservations", () => {
  it("should meet CRED-0001 When the sum of pending prices and a new price exactly equals available turn-start credits, accept the new order and leave zero available. When the sum exceeds those credits, reject it and preserve existing reservations.", () => {
    // Arrange
    const first = [{ cost: 0.1 }]
    // Act & Assert
    expect(canAfford(availableCredits(0.3, first), 0.2)).toBe(true)
    expect(availableCredits(0.3, [...first, { cost: 0.2 }])).toBe("0")
    expect(canAfford(availableCredits(0.29999999999999993, first), 0.2)).toBe(false)
    expect(canAfford(availableCredits(1, [{ cost: 0.10000000000000002 }]), 0.9)).toBe(false)
    expect(availableCredits(1.1, [{ cost: 0.10000000000000002 }, { cost: 0.9 }])).toBe("0.09999999999999998")
    expect(addCredits("1.1", addCredits(-0.10000000000000002, -0.9))).toBe("0.09999999999999998")
    expect(canAfford("0", 0.000000001)).toBe(false)
    expect(canAfford(availableCredits(1e308, [{ cost: 1e-308 }]), 1e308)).toBe(false)
    expect(creditDigits("9.999999999999998e-8")).toBe("0.00000009999999999999998")
    expect(availableCredits(30.3, [{ cost: 30 }, { cost: 0.1 }, { cost: 0.2 }])).toBe("0")
  })
})
