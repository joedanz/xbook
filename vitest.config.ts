import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      include: ["shared/**/*.ts", "src/**/*.ts"],
    },
  },
  resolve: {
    alias: {
      // Web app path aliases (match web/tsconfig.json paths)
      "@/": resolve(__dirname, "web") + "/",
      "@shared/": resolve(__dirname, "shared") + "/",
      // Resolve next from web/node_modules so route handler tests work
      next: resolve(__dirname, "web/node_modules/next"),
    },
  },
});
