import { Decimal } from "decimal.js"

// CONSTRAINT: A difference of two finite binary64 prices can span more than 600 decimal places.
const Money = Decimal.clone({ precision: 1000 })
export function creditDigits(value: string | number): string {
  return new Money(value).toFixed()
}
export function addCredits(balance: string | number, change: string | number): string {
  return new Money(balance).plus(change).toString()
}
export function availableCredits(balance: string | number, orders: ReadonlyArray<{ cost: number }>): string {
  return orders.reduce((remaining, order) => remaining.minus(order.cost), new Money(balance)).toString()
}
export function canAfford(available: string, price: number): boolean {
  return new Money(available).gte(price)
}
