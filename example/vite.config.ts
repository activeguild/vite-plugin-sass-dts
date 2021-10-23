import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import sassDts from "vite-plugin-sass-dts";
import path from "path";

export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/styles" as common;`,
        // [Sample]
        // additionalData: (content: string, path: string): string => {
        //   return [
        //     '@use "@/styles" as common;',
        //     content,
        //   ].join('\n');
        // },
        importer(...args) {
          if (args[0] !== "@/styles") {
            return;
          }

          return {
            file: `${path.resolve(
              __dirname,
              "./src/assets/styles"
            )}`,
          };
        },
      },
    },
  },
  plugins: [
    react(),
    sassDts({
      allGenerate: true,
      global: {
        generate: true,
        outFile: path.resolve(__dirname, "./src/style.d.ts"),
      },
    }),
  ],
});
