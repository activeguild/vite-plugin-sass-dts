import prettier from 'prettier'
import { Plugin } from 'vite'
import { main } from './main'
import { FinalConfig, PluginOption } from './type'
import { isCSSModuleRequest } from './util'

export default function Plugin(option: PluginOption = {}): Plugin {
  let cacheConfig: FinalConfig
  const enabledMode = option.enabledMode || ['development']
  return {
    name: 'vite-plugin-sass-dts',
    async configResolved(config) {
      const prettierOptions = (await prettier.resolveConfig(config.root)) || {}
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
      if (!enabledMode.includes(cacheConfig.env.MODE)) {
        return { code }
      }

      const fileName = id.replace('?used', '')
      if (!isCSSModuleRequest(fileName)) return { code }

      main(fileName, cacheConfig, option)

      return { code }
    },
  }
}
