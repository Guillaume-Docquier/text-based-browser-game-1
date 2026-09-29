import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { Popover } from "radix-ui"
import { type JSX, useEffect, useId, useRef, useState } from "react"
import { cn } from "@/lib/cn.ts"

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
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()
  const isDisabled = disabled || options.length <= 1
  const isOpen = open && !isDisabled
  const selectedOption = options.find((option) => option.id === value)
  const normalizedSearch = search.trim().toLowerCase()
  const matchingOptions =
    normalizedSearch === "" ? options : options.filter((option) => option.label.toLowerCase().includes(normalizedSearch))
  const visibleOptions = matchingOptions.slice(0, MAX_VISIBLE_OPTIONS)
  const activeOption = visibleOptions[activeIndex]

  useEffect(() => {
    if (isOpen && activeOption !== undefined) {
      document.getElementById(`${listboxId}-option-${activeIndex}`)?.scrollIntoView({ block: "nearest" })
    }
  }, [activeIndex, activeOption, isOpen, listboxId])

  const changeOpen = (nextOpen: boolean): void => {
    setOpen(nextOpen)
    setSearch("")
    setActiveIndex(0)
  }

  const selectOption = (option: TOption): void => {
    onValueChange(option.id)
    changeOpen(false)
  }

  return (
    <Popover.Root open={isOpen} onOpenChange={changeOpen}>
      <Popover.Anchor asChild>
        <div
          className={cn(
            "flex h-9 w-full min-w-0 items-center gap-1.5 rounded-3xl border border-transparent bg-input/50 px-3 text-sm transition-[color,box-shadow,background-color] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
            isDisabled && "cursor-not-allowed opacity-50",
          )}
          onPointerDown={(event) => {
            if (event.target !== inputRef.current) {
              event.preventDefault()
              inputRef.current?.focus()
            }
          }}
        >
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label={label}
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls={isOpen ? listboxId : undefined}
            aria-activedescendant={isOpen && activeOption !== undefined ? `${listboxId}-option-${activeIndex}` : undefined}
            className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            value={isOpen ? search : (selectedOption?.label ?? "")}
            placeholder={placeholder}
            disabled={isDisabled}
            onFocus={() => {
              changeOpen(true)
            }}
            onClick={() => {
              if (!isOpen) {
                changeOpen(true)
              }
            }}
            onChange={(event) => {
              if (!isOpen) {
                changeOpen(true)
              }
              setSearch(event.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={(event) => {
              if (!isOpen && event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
                event.preventDefault()
                changeOpen(true)
                setSearch(event.key)
                return
              }
              switch (event.key) {
                case "ArrowDown":
                  event.preventDefault()
                  if (!isOpen) {
                    changeOpen(true)
                  } else {
                    setActiveIndex((index) => Math.min(index + 1, Math.max(visibleOptions.length - 1, 0)))
                  }
                  break
                case "ArrowUp":
                  event.preventDefault()
                  if (!isOpen) {
                    changeOpen(true)
                  } else {
                    setActiveIndex((index) => Math.max(index - 1, 0))
                  }
                  break
                case "Enter":
                  event.preventDefault()
                  if (isOpen) {
                    if (activeOption !== undefined) {
                      selectOption(activeOption)
                    }
                  } else {
                    changeOpen(true)
                  }
                  break
                case "Escape":
                  if (isOpen) {
                    event.preventDefault()
                    changeOpen(false)
                  }
                  break
              }
            }}
          />
          <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          role="presentation"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
          }}
          onInteractOutside={(event) => {
            if (event.target === inputRef.current) {
              event.preventDefault()
            }
          }}
          className="dark z-50 max-h-[min(18rem,var(--radix-popover-content-available-height))] w-(--radix-popover-trigger-width) min-w-36 overflow-y-auto rounded-3xl bg-popover/90 p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/5 backdrop-blur-2xl backdrop-saturate-150"
        >
          {visibleOptions.length > 0 ? (
            <div id={listboxId} role="listbox" aria-label={label}>
              {visibleOptions.map((option, index) => (
                <button
                  key={option.id}
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={option.id === value}
                  tabIndex={-1}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left text-sm font-medium outline-none",
                    activeIndex === index && "bg-foreground/10",
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault()
                  }}
                  onMouseEnter={() => {
                    setActiveIndex(index)
                  }}
                  onClick={() => {
                    selectOption(option)
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {option.id === value ? <CheckIcon className="size-4 shrink-0" aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
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
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
