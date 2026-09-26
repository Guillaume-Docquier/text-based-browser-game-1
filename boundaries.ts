import path from "node:path"
import type { DependenciesPolicy, DependenciesRuleOptions, Settings } from "eslint-plugin-boundaries"
import type { OxlintConfig } from "oxlint"

type ElementType = (typeof Elements)[keyof typeof Elements]["type"]
const Elements = {
  RULESET_MODEL: { type: "ruleset-model", pattern: "backend/src/lib/rules-engine/ruleset-model" },
  VALIDATION: { type: "validation", pattern: "backend/src/lib/validation" },
  DB: { type: "db", pattern: "backend/src/lib/db" },
} as const

const Policies = Object.fromEntries([
  policy({
    type: Elements.RULESET_MODEL.type,
    disallow: { to: { module: { origin: "local" } } },
    allow: {
      to: {
        element: {
          type: [Elements.RULESET_MODEL.type, Elements.VALIDATION.type, Elements.DB.type],
        },
      },
    },
  }),
])

/** Boundary element settings and dependency policies for the repository. */
export const Boundaries = {
  settings: {
    "boundaries/root-path": import.meta.dirname,
    "boundaries/elements": [
      { ...Elements.RULESET_MODEL, partialMatch: false },
      { ...Elements.VALIDATION, partialMatch: false },
      { ...Elements.DB, partialMatch: false },
    ],
    "boundaries/flag-as-external": {
      unresolvableAlias: false,
      inNodeModules: true,
    },
    "import/resolver": {
      typescript: {
        project: path.resolve(import.meta.dirname, "backend/tsconfig.json"),
      },
    },
  } satisfies Settings & Pick<NonNullable<OxlintConfig["settings"]>, "import/resolver">,
  dependencies: {
    default: "allow",
    checkAllOrigins: false,
    checkUnknownLocals: true,
    checkInternals: true,
    policies: Object.values(Policies).flat(),
  } satisfies DependenciesRuleOptions,
}

function policy({
  type,
  allow,
  disallow,
}: {
  type: ElementType
  allow?: DependenciesPolicy["allow"]
  disallow?: DependenciesPolicy["disallow"]
}): [ElementType, DependenciesPolicy[]] {
  const from = { element: { type } }

  const policies: DependenciesPolicy[] = []

  if (disallow !== undefined) {
    policies.push({ from, disallow })
  }

  if (allow !== undefined) {
    policies.push({ from, allow })
  }

  return [type, policies]
}
