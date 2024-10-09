import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.js"],
  format: ["cjs", "esm"],
  outDir: "dist",
  dts: true,
});
