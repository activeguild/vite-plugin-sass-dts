import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import sassDts from "vite-plugin-sass-dts";

export default defineConfig({
  plugins: [react(), sassDts()],
});
