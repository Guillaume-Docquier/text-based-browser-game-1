import type { Clock } from "#lib/Clock.ts"
import { Datetime } from "#lib/Datetime.ts"

export class ClockMock implements Clock {
  private rightNow: Date

  public constructor({ startDate = new Date() }: { startDate?: Date } = {}) {
    this.rightNow = startDate
  }

  public increment({ incrementSeconds }: { incrementSeconds: number }): void {
    this.rightNow = Datetime.increment({ date: this.rightNow, incrementSeconds })
  }

  public now(): Date {
    return this.rightNow
  }
}
