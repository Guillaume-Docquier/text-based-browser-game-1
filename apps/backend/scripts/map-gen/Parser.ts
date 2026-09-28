import path from "node:path"
import { InvalidArgumentError } from "commander"

/** Parsers for map generator command-line arguments. */
export const Parser = {
  number: (value: string): number => {
    const parsedValue = Number(value)
    if (!Number.isFinite(parsedValue)) {
      throw new InvalidArgumentError(`must be a finite number, received '${value}'`)
    }

    return parsedValue
  },
  integer: (value: string): number => {
    const parsedValue = Parser.number(value)
    if (!Number.isInteger(parsedValue)) {
      throw new InvalidArgumentError(`must be an integer, received '${value}'`)
    }

    return parsedValue
  },
  nonNegativeInteger: (value: string): number => {
    const parsedValue = Parser.integer(value)
    if (parsedValue < 0) {
      throw new InvalidArgumentError(`must be greater than or equal to zero, received '${value}'`)
    }

    return parsedValue
  },
  positiveInteger: (value: string): number => {
    const parsedValue = Parser.nonNegativeInteger(value)
    if (parsedValue === 0) {
      throw new InvalidArgumentError(`must be greater than zero, received '${value}'`)
    }

    return parsedValue
  },
  positiveNumber: (value: string): number => {
    const parsedValue = Parser.number(value)
    if (parsedValue <= 0) {
      throw new InvalidArgumentError(`must be greater than zero, received '${value}'`)
    }

    return parsedValue
  },
  filePath: (value: string): string => path.resolve(value),
} as const
