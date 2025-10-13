import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      enabled: false,
    },
    hookTimeout: 20000,
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
})
