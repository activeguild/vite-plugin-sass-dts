// import { Importer, ImporterReturnType, renderSync } from 'sass'
import type Sass from 'sass'
import { getPreprocessorOptions } from './options'
import type { AdditionalData, CSS, FinalConfig } from './type'
import { createRequire } from 'node:module'

const SPLIT_STR = `/* vite-plugin-sass-dts */\n`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loadedSassPreprocessor: any

const _require = import.meta.url ? createRequire(import.meta.url) : require

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

  const internalImporter: Sass.LegacyImporter = (url, importer, done) => {
    resolveFn(url, importer).then((resolved) => {
      if (resolved) {
        new Promise<Sass.LegacyImporterResult>(function (resolve) {
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
      ? finalImporter.unshift(...options.importer)
      : finalImporter.unshift(options.importer)
  }

  const result = sass.renderSync({
    ...options,
    data: await getData(file.toString(), fileName, options.additionalData),
    file: fileName,
    includePaths: ['node_modules'],
    importer: finalImporter,
    alias: config.resolve.alias,
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
    const fallbackPaths = _require.resolve.paths?.('sass') || []
    const resolved = _require.resolve('sass', {
      paths: [config.root, ...fallbackPaths],
    })
    return (loadedSassPreprocessor = _require(resolved))
  } catch (e) {
    console.error(e)
    throw new Error(
      `Preprocessor dependency 'sass' not found. Did you install it?`
    )
  }
}
