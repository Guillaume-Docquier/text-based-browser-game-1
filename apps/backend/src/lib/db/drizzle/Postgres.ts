import { type Enumify, isNodeJSError } from "@guillaume-docquier/tools-ts"

type ErrorCode = Enumify<typeof ErrorCode>

/**
 * Postgres error codes that we care about.
 * https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const ErrorCode = {
  UNIQUE_VIOLATION: "23505",
} as const

export const Postgres = {
  ErrorCode,
  /**
   * Checks if a postgres error is the expected error code.
   */
  isErrorWithCode: (error: Error, errorCode: ErrorCode): boolean => {
    // According to ChatGPT, the code would be on the error
    if (isNodeJSError(error) && error.code === errorCode) {
      return true
    }

    if (isNodeJSError(error.cause)) {
      // But from my testing, it's on the error.cause
      return error.cause.code === errorCode
    }

    return false
  },
}
