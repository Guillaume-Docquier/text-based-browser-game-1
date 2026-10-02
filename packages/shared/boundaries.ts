import path from "node:path"
import type { DependenciesPolicy, Rules, Settings } from "eslint-plugin-boundaries"
import type { OxlintConfig } from "oxlint"

type Element = (typeof Elements)[keyof typeof Elements]
const Elements = {
  DOMAIN: { type: "domain", pattern: "src/domain" },
  TESTING: { type: "testing", pattern: "src/testing" },
  GALAXY_CREATION: { type: "galaxy-creation", pattern: "src/galaxy-creation" },
  ACTION_SUBMISSION: { type: "action-submission", pattern: "src/action-submission" },
  TURN_RESOLUTION: { type: "turn-resolution", pattern: "src/turn-resolution" },
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
        project: path.resolve(import.meta.dirname, "tsconfig.package.json"),
      },
    },
    "boundaries/elements": [
      { ...Elements.DOMAIN, partialMatch: false },
      { ...Elements.TESTING, partialMatch: false },
      { ...Elements.GALAXY_CREATION, partialMatch: false },
      { ...Elements.ACTION_SUBMISSION, partialMatch: false },
      { ...Elements.TURN_RESOLUTION, partialMatch: false },
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
            element: Elements.DOMAIN,
            disallow: DisallowEverything,
            allow: elements([Elements.DOMAIN]),
          }),
          ...policy({
            element: Elements.TESTING,
            disallow: DisallowEverything,
            allow: elements([Elements.TESTING, Elements.DOMAIN]),
          }),
          ...policy({
            element: Elements.GALAXY_CREATION,
            disallow: DisallowEverything,
            allow: elements([Elements.GALAXY_CREATION, Elements.DOMAIN, Elements.TESTING]),
          }),
          ...policy({
            element: Elements.ACTION_SUBMISSION,
            disallow: DisallowEverything,
            allow: elements([Elements.ACTION_SUBMISSION, Elements.TURN_RESOLUTION, Elements.DOMAIN, Elements.TESTING]),
          }),
          ...policy({
            element: Elements.TURN_RESOLUTION,
            disallow: DisallowEverything,
            allow: elements([Elements.TURN_RESOLUTION, Elements.ACTION_SUBMISSION, Elements.DOMAIN, Elements.TESTING]),
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

function elements(definitions: readonly Element[]): NonNullable<DependenciesPolicy["allow"]> {
  return {
    to: definitions.map((definition) => ({
      element: { type: definition.type },
    })),
  }
}
