/**
 * A Range for percentage values between [0, 1]
 * The Range bounds are both inclusive
 *
 * We might want to use Branded types for this in the future
 */
export type PercentageRange = Range

/**
 * A Range for integer values between [-inf, +inf]
 * The Range bounds are both inclusive
 *
 * We might want to use Branded types for this in the future
 */
export type IntegerRange = Range

/**
 * A Range of values
 * The Range bounds are both inclusive
 */
type Range = {
  /**
   * Inclusive
   */
  min: number

  /**
   * Inclusive
   */
  max: number
}
