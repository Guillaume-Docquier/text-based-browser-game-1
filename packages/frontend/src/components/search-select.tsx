import { Combobox } from "@base-ui/react/combobox"
import { cn } from "cn"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { type JSX, useRef, useState } from "react"

const MAX_VISIBLE_OPTIONS = 50

type SearchSelectOption = { id: string; label: string }

/**
 * Selects one value from a searchable list without mounting every option.
 */
export function SearchSelect<TOption extends SearchSelectOption>({
  label,
  options,
  value,
  placeholder,
  disabled = false,
  onValueChange,
}: {
  label: string
  options: readonly TOption[]
  value: TOption["id"] | undefined
  placeholder: string
  disabled?: boolean
  onValueChange: (value: TOption["id"]) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const anchorRef = useRef<HTMLDivElement>(null)
  const isDisabled = disabled || options.length <= 1
  const isOpen = open && !isDisabled
  const selectedOption = options.find((option) => option.id === value)
  const normalizedSearch = search.trim().toLowerCase()
  const matchingOptions =
    normalizedSearch === "" ? options : options.filter((option) => option.label.toLowerCase().includes(normalizedSearch))
  const visibleOptions = matchingOptions.slice(0, MAX_VISIBLE_OPTIONS)

  return (
    <Combobox.Root
      items={options}
      filteredItems={visibleOptions}
      value={selectedOption ?? null}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.id}
      isItemEqualToValue={(option, selected) => option.id === selected.id}
      onValueChange={(option) => {
        if (option !== null) {
          onValueChange(option.id)
        }
      }}
      disabled={isDisabled}
      autoHighlight
      loopFocus={false}
      open={isOpen}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setSearch("")
        }
      }}
      inputValue={isOpen ? search : (selectedOption?.label ?? "")}
      onInputValueChange={(nextSearch, details) => {
        if (details.reason === "input-change") {
          setSearch(nextSearch)
        }
      }}
    >
      <Combobox.InputGroup
        ref={anchorRef}
        className={cn(
          "flex h-9 w-full min-w-0 items-center gap-1.5 rounded-3xl border border-transparent bg-input/50 px-3 text-sm transition-[color,box-shadow,background-color] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
          isDisabled && "cursor-not-allowed opacity-50",
        )}
      >
        <Combobox.Input
          aria-label={label}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          onFocus={() => {
            setOpen(true)
          }}
        />
        <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner anchor={anchorRef} align="start" sideOffset={4} className="z-50">
          <Combobox.Popup className="dark max-h-[min(18rem,var(--available-height))] w-(--anchor-width) min-w-36 overflow-y-auto rounded-3xl bg-popover/90 p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/5 backdrop-blur-2xl backdrop-saturate-150">
            {visibleOptions.length > 0 ? (
              <Combobox.List aria-label={label}>
                {(option: TOption) => (
                  <Combobox.Item
                    key={option.id}
                    value={option}
                    className="flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left text-sm font-medium outline-none data-highlighted:bg-foreground/10"
                  >
                    <span className="truncate">{option.label}</span>
                    <Combobox.ItemIndicator>
                      <CheckIcon className="size-4 shrink-0" aria-hidden="true" />
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
                )}
              </Combobox.List>
            ) : (
              <div role="status" className="px-3 py-2 text-sm text-muted-foreground">
                No matching options
              </div>
            )}
            {matchingOptions.length > MAX_VISIBLE_OPTIONS ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Showing first {MAX_VISIBLE_OPTIONS} of {matchingOptions.length}. Keep typing to narrow the list.
              </div>
            ) : null}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
