import type { RuleTester } from "oxlint/plugins-dev"

type OxlintRule = Parameters<RuleTester["run"]>[1]
type RuleVisitor = ReturnType<NonNullable<OxlintRule["create"]>>

export const noRenamedImports = {
  create(context): RuleVisitor {
    return {
      ImportSpecifier(specifier): void {
        const importedName = specifier.imported.type === "Literal" ? specifier.imported.value : specifier.imported.name
        const localName = specifier.local.name
        if (localName === importedName) {
          return
        }

        const declaration = specifier.parent
        if (
          localName === `${importedName}Primitive` &&
          declaration.type === "ImportDeclaration" &&
          (declaration.source.value === "@base-ui/react" || declaration.source.value.startsWith("@base-ui/react/"))
        ) {
          return
        }

        context.report({ node: specifier, message: "Use the exported name for named imports." })
      },
    }
  },
} satisfies OxlintRule
