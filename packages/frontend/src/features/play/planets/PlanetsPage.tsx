import type { Player, Planet } from "@api-types"
import { Assert, Sort } from "@guillaume-docquier/tools-ts"
import { Link } from "@tanstack/react-router"
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react"
import { type ReactElement, useState } from "react"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { Input } from "@/components/input.tsx"
import { ScrollArea, ScrollBar } from "@/components/scroll-area.tsx"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/select.tsx"
import { usePlayGameContext } from "@/features/play/PlayContext.tsx"
import { PLAYER_COLOR_HEX } from "@/lib/playerColorHex.ts"

type PlanetRow = { readonly planet: Planet; readonly owner: Player | undefined; readonly ownerLabel: string }
type SortColumn = "planet" | "owner" | "coordinates" | "metalProduction" | "remainingMetalDeposit" | "area"
type SortDirection = "ascending" | "descending"
type PlanetSort = { readonly column: SortColumn; readonly direction: SortDirection }
type PlanetRowComparator = (first: PlanetRow, second: PlanetRow) => number

const ALL_PLAYERS = "all"
const ALL_PLANETS = "all-planets"
type OwnerFilter = PlayerId | typeof ALL_PLAYERS | typeof ALL_PLANETS
const TEXT_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })
const SORT_COMPARATORS = {
  planet: (first, second) => TEXT_COLLATOR.compare(first.planet.name, second.planet.name),
  owner: (first, second) => TEXT_COLLATOR.compare(first.ownerLabel, second.ownerLabel),
  coordinates: (first, second) => TEXT_COLLATOR.compare(first.planet.coordinates, second.planet.coordinates),
  metalProduction: (first, second) => first.planet.metalProduction - second.planet.metalProduction,
  remainingMetalDeposit: (first, second) => first.planet.remainingMetalDeposit - second.planet.remainingMetalDeposit,
  area: (first, second) => first.planet.area - second.planet.area,
  id: (first, second) => TEXT_COLLATOR.compare(first.planet.id, second.planet.id),
} as const satisfies Record<SortColumn | "id", PlanetRowComparator>

export function PlanetsPage(): ReactElement {
  const { gameDetails, playerView } = usePlayGameContext()
  const [search, setSearch] = useState("")
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>(ALL_PLAYERS)
  const [sort, setSort] = useState<PlanetSort>({ column: "owner", direction: "ascending" })
  const rows = createPlanetRows(
    playerView.galaxy.systems.flatMap(({ planets }) => planets),
    gameDetails.players,
  )
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const ownerFilteredRows = rows.filter(
    ({ planet }) =>
      ownerFilter === ALL_PLANETS || (ownerFilter === ALL_PLAYERS ? planet.ownerPlayerId !== null : planet.ownerPlayerId === ownerFilter),
  )
  const searchFilteredRows = filterPlanetRows(ownerFilteredRows, normalizedSearch)
  const sortedRows = sortPlanetRows(searchFilteredRows, sort)

  function changeSort(column: SortColumn): void {
    setSort((currentSort) => ({
      column,
      direction: currentSort.column === column && currentSort.direction === "ascending" ? "descending" : "ascending",
    }))
  }

  function changeOwnerFilter(value: string): void {
    if (value === ALL_PLAYERS || value === ALL_PLANETS) {
      setOwnerFilter(value)
      return
    }

    const owner = gameDetails.players.find(({ id }) => id === value)
    Assert.isDefined(owner)
    setOwnerFilter(owner.id)
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4 py-5 sm:px-6 lg:px-8">
      <PlanetsHeader />
      <PlanetsFilters
        search={search}
        ownerFilter={ownerFilter}
        owners={gameDetails.players}
        onSearchChange={setSearch}
        onOwnerFilterChange={changeOwnerFilter}
      />
      <PlanetsTable gameId={gameDetails.id} rows={sortedRows} sort={sort} emptyMessage={"No matching planets"} onSort={changeSort} />
    </section>
  )
}

function PlanetsHeader(): ReactElement {
  return (
    <header className="mb-5 flex flex-wrap items-baseline gap-3">
      <h2 className="font-heading text-2xl font-semibold text-foreground">Planets</h2>
    </header>
  )
}

function PlanetsFilters({
  search,
  ownerFilter,
  owners,
  onSearchChange,
  onOwnerFilterChange,
}: {
  search: string
  ownerFilter: OwnerFilter
  owners: readonly Player[]
  onSearchChange: (value: string) => void
  onOwnerFilterChange: (value: string) => void
}): ReactElement {
  const ownerItems = [
    { value: ALL_PLAYERS, label: "All players" },
    { value: ALL_PLANETS, label: "All planets" },
    ...owners.map((owner) => ({ value: owner.id, label: owner.alias ?? `Player ${owner.id}` })),
  ]

  return (
    <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center">
      <div className="relative min-w-0 flex-1">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search planets"
          value={search}
          placeholder="Search name or coordinates…"
          className="pl-9"
          onChange={(event) => {
            onSearchChange(event.target.value)
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Owner</span>
        <Select<OwnerFilter>
          value={ownerFilter}
          items={ownerItems}
          onValueChange={(value) => {
            if (value !== null) {
              onOwnerFilterChange(value)
            }
          }}
        >
          <SelectTrigger aria-label="Owner" className="min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ownerItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function PlanetsTable({
  gameId,
  rows,
  sort,
  emptyMessage,
  onSort,
}: {
  gameId: GameId
  rows: readonly PlanetRow[]
  sort: PlanetSort
  emptyMessage: string
  onSort: (column: SortColumn) => void
}): ReactElement {
  return (
    <ScrollArea
      className="min-h-0 min-w-0 flex-1 rounded-xl border border-border/70 bg-card/30"
      scrollbarStyle={{ top: "2.75rem", height: "auto" }}
    >
      <table aria-label="Planets" className="w-full min-w-[56rem] border-collapse text-sm">
        <PlanetTableHeader sort={sort} onSort={onSort} />
        <PlanetTableBody gameId={gameId} rows={rows} emptyMessage={emptyMessage} />
      </table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}

function PlanetTableHeader({ sort, onSort }: { sort: PlanetSort; onSort: (column: SortColumn) => void }): ReactElement {
  return (
    <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
      <tr>
        <SortHeader label="Planet" column="planet" sort={sort} onSort={onSort} />
        <SortHeader label="Owner" column="owner" sort={sort} onSort={onSort} />
        <SortHeader label="Coordinates" column="coordinates" sort={sort} onSort={onSort} />
        <SortHeader label="Metal production per mine per turn" column="metalProduction" sort={sort} onSort={onSort} align="right" />
        <SortHeader label="Remaining metal deposit" column="remainingMetalDeposit" sort={sort} onSort={onSort} align="right" />
        <SortHeader label="Area" column="area" sort={sort} onSort={onSort} align="right" />
      </tr>
    </thead>
  )
}

function PlanetTableBody({
  gameId,
  rows,
  emptyMessage,
}: {
  gameId: GameId
  rows: readonly PlanetRow[]
  emptyMessage: string
}): ReactElement {
  if (rows.length === 0) {
    return (
      <tbody>
        <tr>
          <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
            {emptyMessage}
          </td>
        </tr>
      </tbody>
    )
  }

  return (
    <tbody>
      {rows.map((row) => (
        <PlanetTableRow key={row.planet.id} gameId={gameId} row={row} />
      ))}
    </tbody>
  )
}

function PlanetTableRow({ gameId, row }: { gameId: GameId; row: PlanetRow }): ReactElement {
  const { owner, ownerLabel, planet } = row

  return (
    <tr className="border-t border-border/50">
      <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">{planet.name}</td>
      <td className="whitespace-nowrap px-4 py-3">
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-3 shrink-0 rounded-full border border-foreground/20"
            style={{ backgroundColor: owner === undefined ? "transparent" : PLAYER_COLOR_HEX[owner.color] }}
          />
          {ownerLabel}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <Link
          to="/games/$gameId/play/galaxy"
          params={{ gameId }}
          search={{ planetId: planet.id }}
          className="font-medium text-sky-400 underline decoration-sky-400/60 underline-offset-4 hover:text-sky-300"
        >
          {planet.coordinates}
        </Link>
      </td>
      <NumericCell value={planet.metalProduction} />
      <NumericCell value={planet.remainingMetalDeposit} />
      <NumericCell value={planet.area.toLocaleString()} />
    </tr>
  )
}

function SortHeader({
  label,
  column,
  sort,
  align = "left",
  onSort,
}: {
  label: string
  column: SortColumn
  sort: PlanetSort
  align?: "left" | "right"
  onSort: (column: SortColumn) => void
}): ReactElement {
  const isActive = sort.column === column
  const SortIcon = isActive ? (sort.direction === "ascending" ? ArrowUp : ArrowDown) : ArrowUpDown

  return (
    <th
      scope="col"
      aria-sort={isActive ? sort.direction : "none"}
      className="whitespace-nowrap px-4 py-3 font-medium text-muted-foreground"
    >
      <button
        type="button"
        className={`flex w-full items-center gap-1.5 hover:text-foreground ${align === "right" ? "justify-end" : "justify-start"}`}
        onClick={() => {
          onSort(column)
        }}
      >
        {label}
        <SortIcon aria-hidden="true" className={`size-3.5 ${isActive ? "text-sky-400" : "opacity-50"}`} />
      </button>
    </th>
  )
}

function NumericCell({ value }: { value: number | string }): ReactElement {
  return <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{value}</td>
}

function createPlanetRows(planets: readonly Planet[], players: readonly Player[]): PlanetRow[] {
  const ownersById = new Map(players.map((player) => [player.id, player]))

  return planets.map((planet) => {
    if (planet.ownerPlayerId === null) {
      return { planet, owner: undefined, ownerLabel: "Unclaimed" }
    }
    const owner = ownersById.get(planet.ownerPlayerId)
    Assert.isDefined(owner)

    return {
      planet,
      owner,
      ownerLabel: owner.alias ?? `Player ${owner.id}`,
    }
  })
}

function filterPlanetRows(rows: readonly PlanetRow[], normalizedSearch: string): PlanetRow[] {
  if (normalizedSearch === "") {
    return [...rows]
  }

  return rows.filter(({ planet }) => {
    return planet.name.toLocaleLowerCase().includes(normalizedSearch) || planet.coordinates.toLocaleLowerCase().includes(normalizedSearch)
  })
}

function sortPlanetRows(rows: readonly PlanetRow[], sort: PlanetSort): PlanetRow[] {
  const direction = sort.direction === "ascending" ? 1 : -1

  const compare = Sort.compose(SORT_COMPARATORS[sort.column], SORT_COMPARATORS.planet, SORT_COMPARATORS.id)
  return rows.toSorted((first, second) => direction * compare(first, second))
}
