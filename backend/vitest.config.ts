import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
    pool: "forks",
    hookTimeout: 120000,
    testTimeout: 60000,
  },
});
