import path from "node:path"
import type { Rules, Settings } from "eslint-plugin-boundaries"
import type { OxlintConfig } from "oxlint"

const Elements = {
  DOMAIN: { type: "domain", pattern: "src/domain" },
  GALAXY_CREATION: { type: "galaxy-creation", pattern: "src/galaxy-creation" },
  ACTION_SUBMISSION: { type: "action-submission", pattern: "src/action-submission" },
  TURN_RESOLUTION: { type: "turn-resolution", pattern: "src/turn-resolution" },
  TEST_RULESET: { type: "test-ruleset", pattern: "src/test-ruleset" },
  TESTING: { type: "testing", pattern: "src/testing" },
} as const

const testFiles = { file: { path: "**/*.{test,stub,mock}.ts" } }
const productionFiles = { file: { path: "**/!(*.test|*.stub|*.mock).ts" } }

/**
 * Enforces persistence-free domain definitions and app-independent shared behavior.
 * Policies apply to type imports as well as runtime imports.
 */
export const Boundaries = {
  settings: {
    "boundaries/root-path": path.resolve(import.meta.dirname, "../.."),
    "boundaries/include": ["packages/shared/src/**/*.ts", "apps/**/*.{ts,tsx}"],
    "boundaries/flag-as-external": { unresolvableAlias: false, inNodeModules: true },
    "import/resolver": {
      typescript: { project: path.resolve(import.meta.dirname, "tsconfig.package.json") },
    },
    "boundaries/elements": [
      ...Object.values(Elements).map((element) => ({ ...element, pattern: "packages/shared/" + element.pattern, partialMatch: false })),
      { type: "backend", pattern: "apps/backend", partialMatch: false },
      { type: "frontend", pattern: "apps/frontend", partialMatch: false },
    ],
    "boundaries/files": [
      { category: "test", pattern: "**/*.test.ts" },
      { category: "test-data", pattern: "**/*.{stub,mock}.ts" },
    ],
  } satisfies Settings & Pick<NonNullable<OxlintConfig["settings"]>, "import/resolver">,
  rules: {
    "boundaries/dependencies": [
      "error",
      {
        default: "disallow",
        checkAllOrigins: true,
        checkUnknownLocals: true,
        checkInternals: true,
        policies: [
          {
            allow: {
              to: Object.values(Elements).map(({ type }) => ({ element: { type } })),
            },
          },
          {
            allow: {
              to: {
                module: {
                  origin: "external",
                  source: [
                    "@guillaume-docquier/tools-ts",
                    "@guillaume-docquier/tools-ts/schemas",
                    "zod",
                    "type-fest",
                    "uuid",
                    "transformation-matrix",
                  ],
                },
              },
            },
          },
          {
            from: { element: { type: Elements.DOMAIN.type } },
            disallow: { to: { module: { origin: "local" } } },
          },
          {
            from: { element: { type: Elements.DOMAIN.type } },
            allow: { to: { element: { type: Elements.DOMAIN.type } } },
          },
          {
            from: { element: { type: Elements.DOMAIN.type } },
            disallow: { to: { module: { origin: "external" } } },
          },
          {
            from: { element: { type: Elements.DOMAIN.type } },
            allow: {
              to: {
                module: { origin: "external", source: ["@guillaume-docquier/tools-ts", "@guillaume-docquier/tools-ts/schemas", "zod"] },
              },
            },
          },
          {
            from: testFiles,
            allow: {
              to: [
                ...Object.values(Elements).map(({ type }) => ({ element: { type } })),
                { module: { origin: "external", source: ["vitest", "uuid"] } },
              ],
            },
          },
          {
            from: productionFiles,
            disallow: {
              to: [testFiles, { element: { type: Elements.TESTING.type } }, { module: { origin: "external", source: "vitest" } }],
            },
          },
        ],
      },
    ],
  } satisfies Pick<Rules, "boundaries/dependencies">,
}
