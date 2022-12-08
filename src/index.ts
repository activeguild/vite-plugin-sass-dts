import prettier from 'prettier'
const { resolveConfig } = prettier

import type { Plugin as VitePlugin } from 'vite'
import { main } from './main'
import type { FinalConfig, PluginOptions } from './type'
import { isCSSModuleRequest } from './util'

export default function Plugin(option: PluginOptions = {}): VitePlugin {
  let cacheConfig: FinalConfig
  const enabledMode = option.enabledMode || ['development']
  return {
    name: 'vite-plugin-sass-dts',
    async configResolved(config) {
      const prettierOptions = (await resolveConfig(config.root)) || {}
      cacheConfig = {
        ...config,
        prettierOptions: { ...prettierOptions, filepath: '*.d.ts' },
      }
    },
    handleHotUpdate(context) {
      if (!isCSSModuleRequest(context.file)) return
      main(context.file, cacheConfig, option)
      return
    },
    transform(code, id) {
      const fileName = id.replace('?used', '')

      if (
        !enabledMode.includes(cacheConfig.env.MODE) ||
        !isCSSModuleRequest(fileName)
      ) {
        // returning undefined will signal vite that the file has not been transformed 
        // avoiding warnings about source maps not being generated
        return undefined;
      }

      return new Promise((resolve) =>
        resolve(main(fileName, cacheConfig, option))
      )
    },
  }
}
