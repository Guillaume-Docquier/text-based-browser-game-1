import type { FC } from "react"

interface TextInputProps {
  value: string
  onChange: (newValue: string) => void
  className?: string
  placeholder?: string
}

export const TextInput: FC<TextInputProps> = ({ value, onChange, className, placeholder }) => {
  return (
    <input
      value={value}
      onChange={(event) => {
        onChange(event.target.value)
      }}
      className={`w-full py-1 px-2 ${className}`}
      placeholder={placeholder}
    />
  )
}
