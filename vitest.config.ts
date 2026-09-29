import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"
import path from "node:path"

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "src/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/engine/**/*.ts"],
      exclude: ["src/lib/engine/**/*.test.ts", "src/lib/engine/**/fixtures/**", "src/lib/engine/**/types.ts"],
      reporter: ["text-summary", "text", "html"],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 },
    },
  },
})
