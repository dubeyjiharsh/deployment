import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  // Load env variables
  const env = loadEnv(mode, process.cwd(), "");
  // Use '/' for dev, '/canvas/' or env for production
  const isDev = mode === 'development';
  const base = isDev ? '/' : (env.VITE_BASE_PATH );
  return {
    base,
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    server: {
      port: 2003,
    },
    build: {
      outDir: "dist",
      sourcemap: true,
    },
  };
});