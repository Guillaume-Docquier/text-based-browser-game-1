import type { ReactElement } from "react"

interface TextInputProps {
  value: string
  onChange: (newValue: string) => void
  className?: string
  placeholder?: string
}

export function TextInput({ value, onChange, className, placeholder }: TextInputProps): ReactElement {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => {
        onChange(event.target.value)
      }}
      className={`w-full py-1 px-2 border rounded ${className}`}
      placeholder={placeholder}
    />
  )
}
