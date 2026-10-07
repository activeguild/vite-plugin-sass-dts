import { Plugin as VitePlugin, createFilter } from 'vite'
import { createFinalConfig } from './config'
import { main } from './main'
import type { FinalConfig, PluginOptions } from './type'
import { isCSSModuleRequest } from './util'

export type SassDtsPluginApi = { options: PluginOptions }

export default function Plugin(
  option: PluginOptions = {}
): VitePlugin<SassDtsPluginApi> & { api: SassDtsPluginApi } {
  let cacheConfig: FinalConfig
  let filter: ReturnType<typeof createFilter>
  const enabledMode = option.enabledMode || ['development']
  return {
    name: 'vite-plugin-sass-dts',
    api: { options: option },
    async configResolved(config) {
      filter = createFilter(undefined, option.excludePath)
      cacheConfig = await createFinalConfig(config, option)
    },
    handleHotUpdate(context) {
      if (!isCSSModuleRequest(context.file) || !filter(context.file)) return
      void main(context.file, cacheConfig, option)
      return
    },
    transform(code, id) {
      const fileName = id.replace(/(?:\?|&)(used|direct|inline|vue).*/, '')
      if (
        !enabledMode.includes(cacheConfig.env.MODE) ||
        !isCSSModuleRequest(fileName) ||
        !filter(id)
      ) {
        // returning undefined will signal vite that the file has not been transformed
        // avoiding warnings about source maps not being generated
        return undefined
      }

      // Generation runs in the background so it never blocks the transform.
      void main(fileName, cacheConfig, option)
      return undefined
    },
    watchChange(id) {
      if (isCSSModuleRequest(id) && filter(id)) {
        this.addWatchFile(id)
      }
    },
  }
}
