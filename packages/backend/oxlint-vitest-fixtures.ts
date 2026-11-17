type RuleContext = {
  options: readonly [{ fixtureName: string }]
  report: (diagnostic: { node: object; message: string }) => void
}

const conditional = ":matches(IfStatement, SwitchStatement, ConditionalExpression, LogicalExpression)"

export default {
  meta: { name: "vitest-fixtures" },
  rules: {
    "no-conditional-in-test": {
      meta: {
        schema: {
          type: "array",
          minItems: 1,
          maxItems: 1,
          items: {
            type: "object",
            properties: { fixtureName: { type: "string", minLength: 1 } },
            required: ["fixtureName"],
            additionalProperties: false,
          },
        },
      },
      create(context: RuleContext): Record<string, (node: object) => void> {
        const [{ fixtureName }] = context.options
        const fixtureCall = `CallExpression[callee.name="${fixtureName}"]`
        const parameterizedFixtureCall = `CallExpression[callee.callee.object.name="${fixtureName}"][callee.callee.property.name=/^(each|for)$/]`
        const fixtureCallback = `:matches(${fixtureCall}, ${parameterizedFixtureCall}) > :matches(ArrowFunctionExpression, FunctionExpression).arguments`
        return {
          [`${fixtureCallback} ${conditional}`](node: object): void {
            context.report({ node, message: "Avoid conditionals in tests." })
          },
        }
      },
    },
  },
}
