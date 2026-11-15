import { type LogContext, type LogContextProvider, Timer } from "@guillaume-docquier/tools-ts"

/**
 * Captures the start time on creation and adds the elapsed time to every log
 */
export class ElapsedTimeContextProvider implements LogContextProvider {
  private readonly startTime = Timer.start()

  public getContext(): LogContext {
    return { elapsedTime: Timer.since(this.startTime) }
  }
}
