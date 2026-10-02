import type { StorybookConfig } from "@storybook/react-vite"

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  framework: "@storybook/react-vite",
  addons: ["@storybook/addon-vitest"],
  core: {
    disableTelemetry: true,
    builder: {
      name: "@storybook/builder-vite",
      options: {
        viteConfigPath: ".storybook/vite.config.ts",
      },
    },
  },
}

export default config
