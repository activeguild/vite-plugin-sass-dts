import type { LegacyImporter, LegacyImporterResult } from 'sass-embedded'
import { getPreprocessorOptions } from './options'
import { AdditionalData, CSS, FinalConfig } from './type'

const SPLIT_STR = `/* vite-plugin-sass-dts */\n`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loadedSassPreprocessor: any

export const parseCss = async (
  file: Buffer,
  fileName: string,
  config: FinalConfig
): Promise<CSS> => {
  const sass = loadSassPreprocessor(config)

  const options = getPreprocessorOptions(config)
  const resolveFn = config.createResolver({
    extensions: ['.scss', '.sass', '.css'],
    mainFields: ['sass', 'style'],
    tryIndex: true,
    tryPrefix: '_',
    preferRelative: true,
  })

  const internalImporter: LegacyImporter = (url, importer, done) => {
    resolveFn(url, importer).then((resolved) => {
      if (resolved) {
        new Promise<LegacyImporterResult>(function (resolve) {
          resolve({ file: resolved })
        })
          .then(done)
          .catch(done)
      } else {
        done && done(null)
      }
    })
  }

  const finalImporter = [internalImporter]

  if (options.importer) {
    Array.isArray(options.importer)
      ? finalImporter.push(...options.importer)
      : finalImporter.push(options.importer)
  }

  const result = sass.renderSync({
    ...options,
    data: await getData(file.toString(), fileName, options.additionalData),
    file: fileName,
    includePaths: options.includePaths,
    importer: finalImporter,
  })

  const splitted = result.css.toString().split(SPLIT_STR)
  return { localStyle: splitted[1] || '', globalStyle: splitted[0] }
}

const getData = (
  data: string,
  filename: string,
  additionalData?: AdditionalData
): string | Promise<string> => {
  if (!additionalData) return `\n${SPLIT_STR}${data}`
  if (typeof additionalData === 'function') {
    return additionalData(`\n${SPLIT_STR}${data}`, filename)
  }
  return `${additionalData}\n${SPLIT_STR}${data}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadSassPreprocessor = (config: FinalConfig): any => {
  try {
    if (loadedSassPreprocessor) {
      return loadedSassPreprocessor
    }
    const fallbackPaths = require.resolve.paths?.('sass-embedded') || []
    const resolved = require.resolve('sass-embedded', {
      paths: [config.root, ...fallbackPaths],
    })
    console.log(resolved)
    return (loadedSassPreprocessor = require(resolved))
  } catch (e) {
    throw new Error(
      `Preprocessor dependency 'sass-embedded' not found. Did you install it?`
    )
  }
}
