import type { ReactElement } from "react"

interface NumberInputProps {
  value: number
  onChange: (newValue: number) => void
  integer?: boolean
  className?: string
  placeholder?: string
}

export function NumberInput({ value, onChange, integer = false, className, placeholder }: NumberInputProps): ReactElement {
  return (
    <input
      type="number"
      value={value}
      onChange={(event) => {
        onChange(integer ? parseInt(event.target.value) : event.target.valueAsNumber)
      }}
      className={`w-full py-1 px-2 border rounded ${className}`}
      placeholder={placeholder}
    />
  )
}
