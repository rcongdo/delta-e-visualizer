import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.GITHUB_REPOSITORY === "rcongdo/delta-e-visualizer" ? "/delta-e-visualizer/" : "/",
  plugins: [react()],
  test: {
    environment: "jsdom",
  },
});
