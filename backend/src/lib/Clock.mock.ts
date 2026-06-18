import { Datetime, type Time } from "@guillaume-docquier/tools-ts"
import type { Clock } from "#lib/Clock.ts"

export class ClockMock implements Clock {
  private rightNow: Date

  // oxlint-disable-next-line no-restricted-globals -- This is a clock
  public constructor({ startDate = new Date() }: { startDate?: Date } = {}) {
    this.rightNow = startDate
  }

  public increment({ time }: { time: Time }): void {
    this.rightNow = Datetime.increment({ date: this.rightNow, time })
  }

  public now(): Date {
    return this.rightNow
  }
}
