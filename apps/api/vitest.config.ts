import { resolve as resolvePath } from "node:path";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

const swcPlugin = swc.vite({ module: { type: "es6" } });

const resolve = {
  alias: [{ find: /^@\//, replacement: `${resolvePath(__dirname, "src")}/` }],
};

const env = {
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
};

export default defineConfig({
  plugins: [swcPlugin],
  resolve,
  test: {
    passWithNoTests: true,
    projects: [
      {
        plugins: [swcPlugin],
        resolve,
        test: { name: "unit", include: ["src/**/*.test.ts"], environment: "node", env },
      },
      {
        plugins: [swcPlugin],
        resolve,
        test: { name: "integration", include: ["test/**/*.test.ts"], environment: "node", env },
      },
    ],
  },
});
