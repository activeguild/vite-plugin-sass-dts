import { generateDts } from './generate'
import type { FinalConfig, PluginOptions } from './type'
import { isSassException } from './util'
import { writeGeneratedFiles } from './write'

export const main = async (
  fileName: string,
  config: FinalConfig,
  option: PluginOptions
): Promise<void> => {
  try {
    const files = await generateDts(fileName, config, option)
    await writeGeneratedFiles(files)
  } catch (e) {
    if (isSassException(e)) {
      if (e.name !== fileName) {
        console.error('e :>> ', e)
      }
    } else {
      console.error('e :>> ', e)
    }
  }
}
