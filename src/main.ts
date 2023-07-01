import fs from 'fs'
import { parse } from 'postcss'
import { objectify } from 'postcss-js'
import { parseCss } from './css'
import { extractClassNameKeys } from './extract'
import { getParseCase } from './options'
import type { CSS, FinalConfig, PluginOptions } from './type'
import { isSassException } from './util'
import { writeToFile } from './write'

export const main = (
  fileName: string,
  config: FinalConfig,
  option: PluginOptions
) => {
  try {
    fs.readFile(fileName, async (err, file) => {
      if (err) {
        console.error(err)
      } else {
        try {
          const css: CSS = fileName.endsWith('.css')
            ? { localStyle: file.toString() }
            : await parseCss(file, fileName, config)
          const toParseCase = getParseCase(config)
          const classNameKeys = extractClassNameKeys(
            objectify(parse(css.localStyle)),
            toParseCase
          )
          writeToFile(config.prettierOptions, fileName, classNameKeys, option)

          if (!!css.globalStyle && option.global?.generate) {
            const globalClassNameKeys = extractClassNameKeys(
              objectify(parse(css.globalStyle)),
              toParseCase
            )

            writeToFile(
              config.prettierOptions,
              option.global.outputFilePath,
              globalClassNameKeys
            )
          }
        } catch (e) {
          if (isSassException(e)) {
            if (e.name !== fileName) {
              console.error('e :>> ', e)
            }
          }
        }
      }
    })
  } catch (e) {
    console.error('e :>> ', e)
  }
}
