import { Assert, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"

export function repeat({ times, delay, operation }: { times: number; delay: Time; operation: () => void }): void {
  Assert.isTrue(times > 0)

  let nbExecutions = 1
  operation()
  const interval = setInterval(
    () => {
      operation()
      nbExecutions++
      if (nbExecutions >= times) {
        clearInterval(interval)
      }
    },
    Time.in(delay, UnitOfTime.MILLISECONDS),
  )
}
