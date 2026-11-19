import { type Enumify, isNodeJSError } from "@guillaume-docquier/tools-ts"

type ErrorCode = Enumify<typeof ErrorCode>

// CONSTRAINT: Postgres error codes that we care about. See https://www.postgresql.org/docs/current/errcodes-appendix.html
const ErrorCode = {
  UNIQUE_VIOLATION: "23505",
} as const

export const Postgres = {
  ErrorCode,
  isErrorWithCode: (error: Error, errorCode: ErrorCode): boolean => {
    if (isNodeJSError(error) && error.code === errorCode) {
      return true
    }

    if (isNodeJSError(error.cause)) {
      return error.cause.code === errorCode
    }

    return false
  },
}
