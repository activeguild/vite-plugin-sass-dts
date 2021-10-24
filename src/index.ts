import { ConfigEnv, Plugin, UserConfig } from 'vite'
import { main } from './main'
import { PluginOption } from './type'
import { isCSSRequest } from './util'

export default function Plugin(option: PluginOption = {}): Plugin {
  let cacheConfig: UserConfig
  let cacheEnv: ConfigEnv
  return {
    config(config, env) {
      cacheConfig = config
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      cacheEnv = env
    },
    name: 'vite-plugin-sass-dts',
    handleHotUpdate(context) {
      if (!isCSSRequest(context.file)) return
      main(context.file, cacheConfig, option)
      return
    },
    transform(code, id) {
      if (!option.allGenerate) {
        return { code }
      }

      const fileName = id.replace('?used', '')
      if (!isCSSRequest(fileName)) return { code }

      main(fileName, cacheConfig, option)

      return { code }
    },
  }
}
