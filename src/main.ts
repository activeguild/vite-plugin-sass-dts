import fs from 'fs'
import postcss from 'postcss'
import postcssJs from 'postcss-js'
import { UserConfig } from 'vite'
import { parseCss } from './css'
import { extractClassNameKeys } from './extract'
import { CSS, PluginOption } from './type'
import { writeToFile } from './write'

export const main = (
  fileName: string,
  config: UserConfig,
  option: PluginOption
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
          const classNameKeys = extractClassNameKeys(
            postcssJs.objectify(postcss.parse(css.localStyle))
          )
          writeToFile(fileName, classNameKeys, option.global?.outFile)

          if (!!css.globalStyle && option.global?.generate) {
            const globalClassNameKeys = extractClassNameKeys(
              postcssJs.objectify(postcss.parse(css.globalStyle))
            )

            writeToFile(option.global?.outFile, globalClassNameKeys)
          }
        } catch (e) {
          console.error('e :>> ', e)
        }
      }
    })
  } catch (e) {
    console.error('e :>> ', e)
  }
}
