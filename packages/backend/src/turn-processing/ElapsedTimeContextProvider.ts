import { type LogContext, type LogContextProvider, Timer } from "@guillaume-docquier/tools-ts"

export class ElapsedTimeContextProvider implements LogContextProvider {
  private readonly startTime = Timer.start()

  public getContext(): LogContext {
    return { elapsedTime: Timer.since(this.startTime) }
  }
}
