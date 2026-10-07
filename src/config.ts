import prettier from 'prettier'
import type { ResolvedConfig } from 'vite'
import type { FinalConfig, PluginOptions } from './type'

const { resolveConfig, resolveConfigFile } = prettier

export const createFinalConfig = async (
  config: ResolvedConfig,
  option: PluginOptions
): Promise<FinalConfig> => {
  const configPath = option.prettierFilePath
    ? await resolveConfigFile(option.prettierFilePath)
    : null
  const prettierOptions =
    (await resolveConfig(configPath || config.root, {
      config: configPath || undefined,
    })) || {}
  return {
    ...config,
    prettierOptions: { ...prettierOptions, filepath: '*.d.ts' },
  }
}
