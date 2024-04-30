import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import sassDts from 'vite-plugin-sass-dts'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: { '@/alias/': path.join(__dirname, '/src/assets/styles/alias/') },
  },
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
          if (args[0] !== '@/styles') {
            return
          }

          return {
            file: `${path.resolve(__dirname, './src/assets/styles')}`,
          }
        },
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
