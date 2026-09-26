import path from "node:path"
import type { DependenciesPolicy, Rules, Settings } from "eslint-plugin-boundaries"
import type { OxlintConfig } from "oxlint"

type Element = (typeof Elements)[keyof typeof Elements]
const Elements = {
  RULESET_MODEL: { type: "ruleset-model", pattern: "backend/src/lib/rules-engine/ruleset-model" },
  VALIDATION: { type: "validation", pattern: "backend/src/lib/validation" },
  DB: { type: "db", pattern: "backend/src/lib/db" },
} as const

const DisallowEverything = { to: { module: { origin: "local" } } } as const

/**
 * Boundaries settings and rules
 */
export const Boundaries = {
  settings: {
    "boundaries/root-path": import.meta.dirname,
    "boundaries/flag-as-external": {
      unresolvableAlias: false,
      inNodeModules: true,
    },
    "import/resolver": {
      typescript: {
        project: path.resolve(import.meta.dirname, "backend/tsconfig.json"),
      },
    },
    "boundaries/elements": [
      { ...Elements.RULESET_MODEL, partialMatch: false },
      { ...Elements.VALIDATION, partialMatch: false },
      { ...Elements.DB, partialMatch: false },
    ],
  } satisfies Settings & Pick<NonNullable<OxlintConfig["settings"]>, "import/resolver">,
  rules: {
    "boundaries/dependencies": [
      "error",
      {
        default: "allow",
        checkAllOrigins: false,
        checkUnknownLocals: true,
        checkInternals: true,
        policies: [
          ...policy({
            element: Elements.RULESET_MODEL,
            disallow: DisallowEverything,
            allow: elements([Elements.RULESET_MODEL, Elements.VALIDATION, Elements.DB]),
          }),
        ],
      },
    ],
  } satisfies Pick<Rules, "boundaries/dependencies">,
}

/**
 * When disallow and allow overlap, allow wins.
 */
function policy({
  element,
  allow,
  disallow,
}: {
  element: Element
  allow?: DependenciesPolicy["allow"]
  disallow?: DependenciesPolicy["disallow"]
}): DependenciesPolicy[] {
  const policies: DependenciesPolicy[] = []

  if (disallow !== undefined) {
    policies.push({ from: { element }, disallow })
  }

  if (allow !== undefined) {
    policies.push({ from: { element }, allow })
  }

  return policies
}

function elements(definitions: readonly Element[]): { to: { element: { type: string[] } } } {
  return {
    to: { element: { type: definitions.map(({ type }) => type) } },
  } satisfies NonNullable<DependenciesPolicy["allow"]>
}
