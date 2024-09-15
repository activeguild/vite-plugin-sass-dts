import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import sassDts from 'vite-plugin-sass-dts'
import path from 'path'
import { NodePackageImporter, Importer } from 'sass-embedded'
import { URL } from 'url'

export default defineConfig({
  resolve: {
    alias: { '@/alias/': path.join(__dirname, '/src/assets/styles/alias/') },
  },
  css: {
    modules: {
      exportGlobals: true,
    },
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
        api: 'modern',
        importers: [
          new NodePackageImporter(),
          {
            findFileUrl: async function (...args) {
              if (args[0] !== '@/styles') {
                return
              }

              return new URL(
                `file://${path.resolve(__dirname, './src/assets/styles')}`
              )
            },
          } as Importer<'async'>,
        ],
      },
    },
  },
  plugins: [
    react(),
    sassDts({
      enabledMode: ['development', 'production'],
      global: {
        generate: true,
        outputFilePath: path.resolve(__dirname, './src/@types/style.d.ts'),
      },
      prettierFilePath: path.resolve('../../.prettierrc.cjs'),
      excludePath: ['./src/exclude/*'],
      esmExport: true,
      // typeName: {
      //   replacement: (fileName) => {
      //     const spilittedFileName = fileName.split('.')
      //     return `${spilittedFileName[0]}Names`
      //   },
      // },
    }),
  ],
})
