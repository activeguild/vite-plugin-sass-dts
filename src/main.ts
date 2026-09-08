import fs from 'fs'
import { pathToFileURL } from 'node:url'
import { parse } from 'postcss'
import { objectify } from 'postcss-js'
import { parseCss } from './css'
import { extractClassNameKeys } from './extract'
import { getParseCase } from './options'
import {
  extractClassNamePositions,
  resolveOriginalPositions,
  type OriginalPosition,
} from './sourcemap'
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
            : await parseCss(file, fileName, config, !!option.sourceMap)
          const toParseCase = getParseCase(config)
          const classNameKeys = extractClassNameKeys(
            objectify(parse(css.localStyle)),
            toParseCase
          )

          // Class name positions traced back to the scss sources, shared by
          // the local and global d.ts (each maps only the keys it contains).
          let classNamePositions: Map<string, OriginalPosition> | undefined
          if (option.sourceMap && css.css && css.sourceMap) {
            classNamePositions = resolveOriginalPositions(
              extractClassNamePositions(css.css, toParseCase),
              css.sourceMap,
              pathToFileURL(fileName).href,
              css.entryLineOffset ?? 0
            )
          }

          writeToFile(
            config.prettierOptions,
            fileName,
            classNameKeys,
            option,
            classNamePositions
          )

          if (
            !!css.globalStyle &&
            option.global?.generate &&
            option.global?.outputFilePath
          ) {
            const globalClassNameKeys = extractClassNameKeys(
              objectify(parse(css.globalStyle)),
              toParseCase
            )

            writeToFile(
              config.prettierOptions,
              option.global.outputFilePath,
              globalClassNameKeys,
              {
                esmExport: option.esmExport,
                formatter: option.formatter,
                sourceMap: option.sourceMap,
              },
              classNamePositions
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
