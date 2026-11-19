import { type Enumify, isNodeJSError } from "@guillaume-docquier/tools-ts"

type ErrorCode = Enumify<typeof ErrorCode>

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
