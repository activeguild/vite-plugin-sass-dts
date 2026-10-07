import { readFile } from 'node:fs/promises'
import { parse } from 'postcss'
import { objectify } from 'postcss-js'
import { parseCss } from './css'
import { extractClassNameKeys } from './extract'
import { getParseCase } from './options'
import type { CSS, FinalConfig, GeneratedFile, PluginOptions } from './type'
import { buildDtsContent, formatWriteFilePath } from './write'

export const generateDts = async (
  fileName: string,
  config: FinalConfig,
  option: PluginOptions
): Promise<GeneratedFile[]> => {
  const file = await readFile(fileName)
  const css: CSS = fileName.endsWith('.css')
    ? { localStyle: file.toString() }
    : await parseCss(file, fileName, config)
  const toParseCase = getParseCase(config)
  const classNameKeys = extractClassNameKeys(
    objectify(parse(css.localStyle)),
    toParseCase
  )

  const files: GeneratedFile[] = [
    {
      path: formatWriteFilePath(fileName, option),
      content: await buildDtsContent(
        config.prettierOptions,
        fileName,
        classNameKeys,
        option
      ),
    },
  ]

  if (
    !!css.globalStyle &&
    option.global?.generate &&
    option.global?.outputFilePath
  ) {
    const globalOption: PluginOptions = {
      esmExport: option.esmExport,
      formatter: option.formatter,
    }
    const globalClassNameKeys = extractClassNameKeys(
      objectify(parse(css.globalStyle)),
      toParseCase
    )
    files.push({
      path: formatWriteFilePath(option.global.outputFilePath, globalOption),
      content: await buildDtsContent(
        config.prettierOptions,
        option.global.outputFilePath,
        globalClassNameKeys,
        globalOption
      ),
    })
  }

  return files
}
