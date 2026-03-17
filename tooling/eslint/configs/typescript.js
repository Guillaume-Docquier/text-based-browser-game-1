import tseslint from "typescript-eslint"
import stylisticPlugin from "@stylistic/eslint-plugin"
import importPlugin from "eslint-plugin-import"
import nodePlugin from "eslint-plugin-n"
import promisePlugin from "eslint-plugin-promise"

export default {
  name: "@ventionco/eslint-config-typescript",
  files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      project: true,
      sourceType: "module",
      ecmaVersion: 2022,
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
  plugins: {
    "@typescript-eslint": tseslint.plugin,
    "@stylistic": stylisticPlugin,
    import: importPlugin,
    n: nodePlugin,
    promise: promisePlugin,
  },
  rules: {
    "@typescript-eslint/adjacent-overload-signatures": ["error"],
    "@typescript-eslint/array-type": [
      "error",
      {
        default: "array-simple",
      },
    ],
    "@typescript-eslint/await-thenable": ["error"],
    "@typescript-eslint/ban-ts-comment": [
      "error",
      {
        minimumDescriptionLength: 3,
        "ts-check": false,
        "ts-expect-error": "allow-with-description",
        "ts-ignore": true,
        "ts-nocheck": true,
      },
    ],
    "@typescript-eslint/ban-tslint-comment": ["error"],
    "@typescript-eslint/no-empty-object-type": "error",
    "@typescript-eslint/no-unsafe-function-type": "error",
    "@typescript-eslint/no-wrapper-object-types": "error",
    "@typescript-eslint/class-literal-property-style": ["error", "fields"],
    "@typescript-eslint/consistent-generic-constructors": ["error", "constructor"],
    "@typescript-eslint/consistent-indexed-object-style": ["error", "record"],
    "@typescript-eslint/consistent-type-assertions": [
      "error",
      {
        assertionStyle: "as",
        objectLiteralTypeAssertions: "never",
      },
    ],
    "@typescript-eslint/consistent-type-exports": [
      "error",
      {
        fixMixedExportsWithInlineTypeSpecifier: true,
      },
    ],
    "@typescript-eslint/consistent-type-imports": [
      "error",
      {
        disallowTypeAnnotations: true,
        fixStyle: "inline-type-imports",
        prefer: "type-imports",
      },
    ],
    "@typescript-eslint/dot-notation": [
      "error",
      {
        allowIndexSignaturePropertyAccess: false,
        allowKeywords: true,
        allowPattern: "",
        allowPrivateClassPropertyAccess: false,
        allowProtectedClassPropertyAccess: false,
      },
    ],
    "@typescript-eslint/explicit-function-return-type": [
      "error",
      {
        allowDirectConstAssertionInArrowFunctions: true,
        allowHigherOrderFunctions: true,
        allowTypedFunctionExpressions: true,
      },
    ],
    "@stylistic/lines-between-class-members": [
      "error",
      "always",
      {
        exceptAfterOverload: true,
        exceptAfterSingleLine: true,
      },
    ],
    "@typescript-eslint/method-signature-style": ["error"],
    "@typescript-eslint/naming-convention": [
      "error",
      {
        format: ["PascalCase", "UPPER_CASE", "camelCase"],
        leadingUnderscore: "allow",
        selector: "variableLike",
        trailingUnderscore: "allow",
      },
    ],
    "@typescript-eslint/no-array-constructor": ["error"],
    "@typescript-eslint/no-base-to-string": ["error"],
    "@typescript-eslint/no-confusing-void-expression": [
      "error",
      {
        ignoreArrowShorthand: false,
        ignoreVoidOperator: false,
      },
    ],
    "@typescript-eslint/no-dupe-class-members": ["error"],
    "@typescript-eslint/no-dynamic-delete": ["error"],
    "@typescript-eslint/no-empty-interface": [
      "error",
      {
        allowSingleExtends: true,
      },
    ],
    "@typescript-eslint/no-explicit-any": ["error"],
    "@typescript-eslint/no-extra-non-null-assertion": ["error"],
    "@typescript-eslint/no-extraneous-class": [
      "error",
      {
        allowWithDecorator: true,
      },
    ],
    "@typescript-eslint/no-floating-promises": ["error"],
    "@typescript-eslint/no-for-in-array": ["error"],
    "@typescript-eslint/no-implied-eval": ["error"],
    "@typescript-eslint/no-invalid-void-type": [
      "error",
      {
        allowAsThisParameter: true,
      },
    ],
    "@typescript-eslint/no-loss-of-precision": ["error"],
    "@typescript-eslint/no-misused-new": ["error"],
    "@typescript-eslint/no-misused-promises": ["error"],
    "@typescript-eslint/no-namespace": ["error"],
    "@typescript-eslint/no-non-null-asserted-optional-chain": ["error"],
    "@typescript-eslint/no-non-null-assertion": ["error"],
    "@typescript-eslint/no-this-alias": [
      "error",
      {
        allowDestructuring: true,
      },
    ],
    "no-throw-literal": "off",
    "@typescript-eslint/only-throw-error": ["error"],
    "@typescript-eslint/no-unnecessary-boolean-literal-compare": ["error"],
    "@typescript-eslint/no-unnecessary-type-assertion": ["error"],
    "@typescript-eslint/no-unnecessary-type-constraint": ["error"],
    "@typescript-eslint/no-unsafe-argument": ["error"],
    "@typescript-eslint/no-unused-expressions": [
      "error",
      {
        allowShortCircuit: true,
        allowTaggedTemplates: true,
        allowTernary: true,
        enforceForJSX: false,
      },
    ],
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        varsIgnorePattern: "^_",
        argsIgnorePattern: "^_",
        // We don't allow ignoring caught errors, as it's a bad idea to swallow errors
      },
    ],
    "@typescript-eslint/no-use-before-define": [
      "error",
      {
        classes: false,
        enums: false,
        functions: false,
        typedefs: false,
        variables: false,
      },
    ],
    "@typescript-eslint/no-useless-constructor": ["error"],
    "@typescript-eslint/no-var-requires": ["error"],
    "@typescript-eslint/non-nullable-type-assertion-style": ["error"],
    "@typescript-eslint/prefer-function-type": ["error"],
    "@typescript-eslint/prefer-includes": ["error"],
    "@typescript-eslint/prefer-nullish-coalescing": [
      "error",
      {
        ignoreConditionalTests: false,
        ignoreMixedLogicalExpressions: false,
      },
    ],
    "@typescript-eslint/prefer-optional-chain": ["error"],
    "@typescript-eslint/prefer-readonly": ["error"],
    "@typescript-eslint/prefer-reduce-type-parameter": ["error"],
    "@typescript-eslint/prefer-return-this-type": ["error"],
    "@typescript-eslint/prefer-ts-expect-error": ["error"],
    "@typescript-eslint/promise-function-async": ["error"],
    "@typescript-eslint/require-array-sort-compare": [
      "error",
      {
        ignoreStringArrays: true,
      },
    ],
    "@typescript-eslint/restrict-plus-operands": [
      "error",
      {
        skipCompoundAssignments: false,
      },
    ],
    "@typescript-eslint/restrict-template-expressions": [
      "error",
      {
        allowNumber: true,
      },
    ],
    "@typescript-eslint/return-await": ["error", "always"],
    "@typescript-eslint/strict-boolean-expressions": [
      "error",
      {
        allowAny: false,
        allowNullableBoolean: false,
        allowNullableNumber: false,
        allowNullableObject: false,
        allowNullableString: false,
        allowNumber: false,
        allowString: false,
      },
    ],
    "@typescript-eslint/triple-slash-reference": [
      "error",
      {
        lib: "never",
        path: "never",
        types: "never",
      },
    ],
    "@typescript-eslint/unbound-method": [
      "error",
      {
        ignoreStatic: false,
      },
    ],
    "accessor-pairs": [
      "error",
      {
        enforceForClassMembers: true,
        getWithoutSet: false,
        setWithoutGet: true,
      },
    ],
    "array-callback-return": [
      "error",
      {
        allowImplicit: false,
        allowVoid: false,
        checkForEach: false,
      },
    ],
    "constructor-super": ["error"],
    "default-case-last": ["error"],
    eqeqeq: ["error", "always"],
    "import/export": ["error"],
    "import/first": ["error"],
    "import/no-absolute-path": [
      "error",
      {
        amd: false,
        commonjs: true,
        esmodule: true,
      },
    ],
    "import/no-duplicates": ["error"],
    "import/no-named-default": ["error"],
    "import/no-webpack-loader-syntax": ["error"],
    "n/handle-callback-err": ["error", "^(err|error)$"],
    "n/no-callback-literal": ["error"],
    "n/no-deprecated-api": ["error"],
    "n/no-exports-assign": ["error"],
    "n/no-new-require": ["error"],
    "n/no-path-concat": ["error"],
    "n/process-exit-as-throw": ["error"],
    "new-cap": [
      "error",
      {
        capIsNew: false,
        newIsCap: true,
        properties: true,
      },
    ],
    "no-async-promise-executor": ["error"],
    "no-caller": ["error"],
    "no-case-declarations": ["error"],
    "no-class-assign": ["error"],
    "no-compare-neg-zero": ["error"],
    "no-cond-assign": ["error"],
    "no-const-assign": ["error"],
    "no-constant-condition": [
      "error",
      {
        checkLoops: false,
      },
    ],
    "no-control-regex": ["error"],
    "no-debugger": ["error"],
    "no-delete-var": ["error"],
    "no-dupe-args": ["error"],
    "no-dupe-keys": ["error"],
    "no-duplicate-case": ["error"],
    "no-empty": [
      "error",
      {
        allowEmptyCatch: true,
      },
    ],
    "no-empty-character-class": ["error"],
    "no-empty-pattern": ["error"],
    "no-eval": ["error"],
    "no-ex-assign": ["error"],
    "no-extend-native": ["error"],
    "no-extra-bind": ["error"],
    "no-extra-boolean-cast": ["error"],
    "no-fallthrough": ["error"],
    "no-func-assign": ["error"],
    "no-global-assign": ["error"],
    "no-import-assign": ["error"],
    "no-invalid-regexp": ["error"],
    "no-irregular-whitespace": ["error"],
    "no-iterator": ["error"],
    "no-labels": [
      "error",
      {
        allowLoop: false,
        allowSwitch: false,
      },
    ],
    "no-lone-blocks": ["error"],
    "no-misleading-character-class": ["error"],
    "no-multi-str": ["error"],
    "no-new": ["error"],
    "no-new-func": ["error"],
    "no-new-object": ["error"],
    "no-new-symbol": ["error"],
    "no-new-wrappers": ["error"],
    "no-obj-calls": ["error"],
    "no-octal": ["error"],
    "no-octal-escape": ["error"],
    "no-proto": ["error"],
    "no-prototype-builtins": ["error"],
    "no-regex-spaces": ["error"],
    "no-return-assign": ["error", "except-parens"],
    "no-self-assign": [
      "error",
      {
        props: true,
      },
    ],
    "no-self-compare": ["error"],
    "no-sequences": ["error"],
    "no-shadow-restricted-names": ["error"],
    "no-sparse-arrays": ["error"],
    "no-template-curly-in-string": ["error"],
    "no-this-before-super": ["error"],
    "no-undef-init": ["error"],
    "no-unmodified-loop-condition": ["error"],
    "no-unneeded-ternary": [
      "error",
      {
        defaultAssignment: false,
      },
    ],
    "no-unreachable": ["error"],
    "no-unreachable-loop": ["error"],
    "no-unsafe-finally": ["error"],
    "no-unsafe-negation": ["error"],
    "no-useless-backreference": ["error"],
    "no-useless-call": ["error"],
    "no-useless-catch": ["error"],
    "no-useless-computed-key": ["error"],
    "no-useless-escape": ["error"],
    "no-useless-rename": ["error"],
    "no-var": ["error"],
    "no-void": [
      "error",
      {
        allowAsStatement: true,
      },
    ],
    "no-with": ["error"],
    "object-shorthand": ["error", "properties"],
    "one-var": ["error", "never"],
    "prefer-const": [
      "error",
      {
        destructuring: "all",
        ignoreReadBeforeAssign: false,
      },
    ],
    "prefer-promise-reject-errors": ["error"],
    "prefer-regex-literals": [
      "error",
      {
        disallowRedundantWrapping: true,
      },
    ],
    "promise/param-names": ["error"],
    "spaced-comment": [
      "error",
      "always",
      {
        block: {
          balanced: true,
          exceptions: ["*"],
          markers: ["!", "*package", ",", ":", "::", "flow-include"],
        },
        line: {
          markers: ["!", "*package", ",", "/", "="],
        },
      },
    ],
    "symbol-description": ["error"],
    "unicode-bom": ["error", "never"],
    "use-isnan": [
      "error",
      {
        enforceForIndexOf: true,
        enforceForSwitchCase: true,
      },
    ],
    "valid-typeof": [
      "error",
      {
        requireStringLiterals: true,
      },
    ],
    yoda: ["error", "never"],
  },
}
