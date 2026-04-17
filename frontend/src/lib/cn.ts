import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges class names and allows for conditional classes
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
