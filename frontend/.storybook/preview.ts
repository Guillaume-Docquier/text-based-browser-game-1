import type { Preview } from "@storybook/react-vite"
import "@/index.css"

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "cosmic",
      values: [{ name: "cosmic", value: "#252525" }],
    },
    controls: {
      expanded: true,
    },
    layout: "centered",
  },
}

export default preview
