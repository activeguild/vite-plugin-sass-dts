import { defineNuxtConfig } from 'nuxt/config'
import sassDts from 'vite-plugin-sass-dts'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  vite: {
    plugins: [sassDts()],
  },
})
