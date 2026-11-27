import { defineConfig } from "lint-staged/config"

export default defineConfig({
  "*": () => "gitleaks git --staged --redact",
  "*.md": ["node scripts/format-requirements.ts --write", "oxfmt --no-error-on-unmatched-pattern"],
  "*.{json,yml,yaml,css,html}": "oxfmt --no-error-on-unmatched-pattern",
  "*.{js,jsx,ts,tsx}": ["oxlint --fix --no-error-on-unmatched-pattern", "oxfmt --no-error-on-unmatched-pattern"],
})
