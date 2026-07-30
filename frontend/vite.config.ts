/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: Number(env.VITE_DEV_SERVER_PORT) || 9000,
    },
    test: {
      // Default to node: crypto.ts/api.ts don't touch the DOM at all, so there's no
      // reason to pay for jsdom. Component tests opt into jsdom per-file via a
      // `// @vitest-environment jsdom` comment at the top of the file.
      environment: "node",
      setupFiles: ["./src/test-setup.ts"],
    },
  };
});
