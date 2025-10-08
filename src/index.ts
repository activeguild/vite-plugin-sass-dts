import prettier from 'prettier'
const { resolveConfig, resolveConfigFile } = prettier

import { Plugin as VitePlugin, createFilter } from 'vite'
import { main } from './main'
import type { FinalConfig, PluginOptions } from './type'
import { isCSSModuleRequest } from './util'

export default function Plugin(option: PluginOptions = {}): VitePlugin {
    let cacheConfig: FinalConfig
    let filter: ReturnType<typeof createFilter>
    const enabledMode = option.enabledMode || ['development']
    return {
        name: 'vite-plugin-sass-dts',
        async configResolved(config) {
            filter = createFilter(undefined, option.excludePath)
            const configPath = option.prettierFilePath
                ? await resolveConfigFile(option.prettierFilePath)
                : null
            const prettierOptions =
                (await resolveConfig(configPath || config.root, {
                    config: configPath || undefined,
                })) || {}
            cacheConfig = {
                ...config,
                prettierOptions: { ...prettierOptions, filepath: '*.d.ts' },
            }
        },
        handleHotUpdate(context) {
            if (!isCSSModuleRequest(context.file) || !filter(context.file))
                return
            main(context.file, cacheConfig, option)
            return
        },
        transform(code, id) {
            const fileName = id.replace(
                /(?:\?|&)(used|direct|inline|vue).*/,
                ''
            )
            if (
                !enabledMode.includes(cacheConfig.env.MODE) ||
                !isCSSModuleRequest(fileName) ||
                !filter(id)
            ) {
                // returning undefined will signal vite that the file has not been transformed
                // avoiding warnings about source maps not being generated
                return undefined
            }

            return new Promise((resolve) =>
                resolve(main(fileName, cacheConfig, option))
            )
        },
        watchChange(id) {
            if (isCSSModuleRequest(id) && filter(id)) {
                this.addWatchFile(id)
            }
        },
    }
}
