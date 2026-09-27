import type { Fleet, GameId, LobbyPlayer, Planet, PlayerId } from "@api-types"
import { Assert } from "@guillaume-docquier/tools-ts"
import { Link } from "@tanstack/react-router"
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react"
import { type ReactElement, useState } from "react"
import { Input } from "@/components/input.tsx"
import { ScrollArea, ScrollBar } from "@/components/scroll-area.tsx"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/select.tsx"
import { usePlayGameContext } from "@/features/play/PlayContext.tsx"
import { PLAYER_COLOR_HEX } from "@/lib/playerColorHex.ts"

type FleetRow = {
  readonly fleet: Fleet
  readonly owner: LobbyPlayer
  readonly ownerLabel: string
  readonly originPlanet: Planet
}
type SortColumn = "fleet" | "owner" | "originPlanet" | "coordinates" | "strength"
type SortDirection = "ascending" | "descending"
type FleetSort = {
  readonly column: SortColumn
  readonly direction: SortDirection
}
type FleetRowComparator = (first: FleetRow, second: FleetRow) => number

const ALL_PLAYERS = "all"
const TEXT_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })
const SORT_COMPARATORS = {
  fleet: (first, second) => TEXT_COLLATOR.compare(first.fleet.name, second.fleet.name),
  owner: (first, second) => TEXT_COLLATOR.compare(first.ownerLabel, second.ownerLabel),
  originPlanet: (first, second) => TEXT_COLLATOR.compare(first.originPlanet.name, second.originPlanet.name),
  coordinates: (first, second) => TEXT_COLLATOR.compare(first.originPlanet.coordinates, second.originPlanet.coordinates),
  strength: (first, second) => first.fleet.strength - second.fleet.strength,
} as const satisfies Record<SortColumn, FleetRowComparator>

/**
 * Lists the Fleets visible to the current player.
 *
 * @returns The filterable and sortable Fleets page.
 */
export function FleetsPage(): ReactElement {
  const { game, playerView } = usePlayGameContext()
  const [search, setSearch] = useState("")
  const [ownerFilter, setOwnerFilter] = useState<PlayerId | typeof ALL_PLAYERS>(ALL_PLAYERS)
  const [sort, setSort] = useState<FleetSort>({ column: "owner", direction: "ascending" })
  const rows = createFleetRows(
    playerView.fleets,
    game.players,
    playerView.galaxy.systems.flatMap(({ planets }) => planets),
  )
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const filteredRows = rows.filter(
    ({ fleet, owner }) =>
      (ownerFilter === ALL_PLAYERS || owner.id === ownerFilter) && fleet.name.toLocaleLowerCase().includes(normalizedSearch),
  )
  const sortedRows = sortFleetRows(filteredRows, sort)

  function changeSort(column: SortColumn): void {
    setSort((currentSort) => ({
      column,
      direction: currentSort.column === column && currentSort.direction === "ascending" ? "descending" : "ascending",
    }))
  }

  function changeOwnerFilter(value: string): void {
    if (value === ALL_PLAYERS) {
      setOwnerFilter(ALL_PLAYERS)
      return
    }

    const owner = game.players.find(({ id }) => id === value)
    Assert.isDefined(owner)
    setOwnerFilter(owner.id)
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4 py-5 sm:px-6 lg:px-8">
      <header className="mb-5 flex flex-wrap items-baseline gap-3">
        <h2 className="font-heading text-2xl font-semibold text-foreground">Fleets</h2>
      </header>
      <FleetsFilters
        search={search}
        ownerFilter={ownerFilter}
        owners={game.players}
        onSearchChange={setSearch}
        onOwnerFilterChange={changeOwnerFilter}
      />
      <FleetsTable
        gameId={game.id}
        rows={sortedRows}
        sort={sort}
        emptyMessage={rows.length === 0 ? "No fleets" : "No matching fleets"}
        onSort={changeSort}
      />
    </section>
  )
}

function FleetsFilters({
  search,
  ownerFilter,
  owners,
  onSearchChange,
  onOwnerFilterChange,
}: {
  search: string
  ownerFilter: PlayerId | typeof ALL_PLAYERS
  owners: readonly LobbyPlayer[]
  onSearchChange: (value: string) => void
  onOwnerFilterChange: (value: string) => void
}): ReactElement {
  return (
    <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center">
      <div className="relative min-w-0 flex-1">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search fleets"
          value={search}
          placeholder="Search fleet ID…"
          className="pl-9"
          onChange={(event) => {
            onSearchChange(event.target.value)
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Owner</span>
        <Select value={ownerFilter} onValueChange={onOwnerFilterChange}>
          <SelectTrigger aria-label="Owner" className="min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PLAYERS}>All players</SelectItem>
            {owners.map((owner) => (
              <SelectItem key={owner.id} value={owner.id}>
                {owner.alias ?? `Player ${owner.id}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function FleetsTable({
  gameId,
  rows,
  sort,
  emptyMessage,
  onSort,
}: {
  gameId: GameId
  rows: readonly FleetRow[]
  sort: FleetSort
  emptyMessage: string
  onSort: (column: SortColumn) => void
}): ReactElement {
  return (
    <ScrollArea
      className="min-h-0 min-w-0 flex-1 rounded-xl border border-border/70 bg-card/30"
      scrollbarStyle={{ top: "2.75rem", height: "auto" }}
    >
      <table aria-label="Fleets" className="w-full min-w-[56rem] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
          <tr>
            <SortHeader label="Fleet" column="fleet" sort={sort} onSort={onSort} />
            <SortHeader label="Owner" column="owner" sort={sort} onSort={onSort} />
            <SortHeader label="Origin planet" column="originPlanet" sort={sort} onSort={onSort} />
            <SortHeader label="Coordinates" column="coordinates" sort={sort} onSort={onSort} />
            <SortHeader label="Strength" column="strength" sort={sort} onSort={onSort} align="right" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => <FleetTableRow key={row.fleet.id} gameId={gameId} row={row} />)
          )}
        </tbody>
      </table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}

function FleetTableRow({ gameId, row }: { gameId: GameId; row: FleetRow }): ReactElement {
  const { fleet, owner, ownerLabel, originPlanet } = row

  return (
    <tr className="border-t border-border/50">
      <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">{fleet.name}</td>
      <td className="whitespace-nowrap px-4 py-3">
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-3 shrink-0 rounded-full border border-foreground/20"
            style={{ backgroundColor: PLAYER_COLOR_HEX[owner.color] }}
          />
          {ownerLabel}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3">{originPlanet.name}</td>
      <td className="whitespace-nowrap px-4 py-3">
        <Link
          to="/games/$gameId/play/galaxy"
          params={{ gameId }}
          search={{ planetId: originPlanet.id }}
          className="font-medium text-sky-400 underline decoration-sky-400/60 underline-offset-4 hover:text-sky-300"
        >
          {originPlanet.coordinates}
        </Link>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{fleet.strength.toLocaleString()}</td>
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
  sort: FleetSort
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

function createFleetRows(fleets: readonly Fleet[], players: readonly LobbyPlayer[], planets: readonly Planet[]): FleetRow[] {
  const ownersById = new Map(players.map((player) => [player.id, player]))
  const planetsById = new Map(planets.map((planet) => [planet.id, planet]))

  return fleets.map((fleet) => {
    const owner = ownersById.get(fleet.playerId)
    const originPlanet = planetsById.get(fleet.originPlanetId)
    Assert.isDefined(owner)
    Assert.isDefined(originPlanet)

    return { fleet, owner, ownerLabel: owner.alias ?? `Player ${owner.id}`, originPlanet }
  })
}

function sortFleetRows(rows: readonly FleetRow[], sort: FleetSort): FleetRow[] {
  const direction = sort.direction === "ascending" ? 1 : -1

  return rows.toSorted((first, second) => {
    const comparison = SORT_COMPARATORS[sort.column](first, second)
    return direction * (comparison !== 0 ? comparison : SORT_COMPARATORS.fleet(first, second))
  })
}
