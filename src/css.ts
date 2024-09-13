// import { Importer, ImporterReturnType, renderSync } from 'sass'
import Sass from 'sass'
import { getPreprocessorOptions } from './options'
import type { AdditionalData, CSS, CssUrlReplacer, FinalConfig } from './type'
import { createRequire } from 'node:module'
import { Alias, normalizePath } from 'vite'
import path from 'path'
import fs from 'fs'
import { importCssRE } from './util'

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

  const internalImporter: Sass.Importer = (url, importer, done) => {
    resolveFn(url, importer).then((resolved) => {
      if (resolved) {
        rebaseUrls(resolved, fileName, config.resolve.alias, '$')
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
  if (options.importers) {
    Array.isArray(options.importers)
      ? finalImporter.push(...options.importers)
      : finalImporter.push(options.importers)
  }

  const data = await getData(file.toString(), fileName, options.additionalData)
  const result = await new Promise<Sass.Result>((resolve, reject) => {
    sass.render(
      {
        ...options,
        data,
        pkgImporter: new sass.NodePackageImporter(),
        file: fileName,
        includePaths: ['node_modules'],
        importer: finalImporter,
        indentedSyntax: fileName.endsWith('.sass'),
      },
      (err: Error, res: Sass.Result) => {
        if (err) {
          reject(err)
        } else {
          resolve(res)
        }
      }
    )
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

const rebaseUrls = async (
  file: string,
  rootFile: string,
  alias: Alias[],
  variablePrefix: string
): Promise<Sass.ImporterReturnType> => {
  file = path.resolve(file) // ensure os-specific flashes
  // in the same dir, no need to rebase
  const fileDir = path.dirname(file)
  const rootDir = path.dirname(rootFile)

  if (fileDir === rootDir) {
    return { file }
  }

  const content = fs.readFileSync(file, 'utf-8')
  const hasImportCss = importCssRE.test(content)
  if (!hasImportCss) {
    return { file }
  }

  let rebased
  const rebaseFn = (url: string) => {
    if (url.startsWith('/')) return url
    if (url.startsWith(variablePrefix)) return url
    for (const { find } of alias) {
      const matches =
        typeof find === 'string' ? url.startsWith(find) : find.test(url)
      if (matches) {
        return url
      }
    }
    const absolute = path.resolve(fileDir, url)
    const relative = path.relative(rootDir, absolute)
    return normalizePath(relative)
  }

  if (hasImportCss) {
    rebased = await rewriteImportCss(content, rebaseFn)
  }

  return {
    file,
    contents: rebased,
  }
}
const rewriteImportCss = (
  css: string,
  replacer: CssUrlReplacer
): Promise<string> => {
  return asyncReplace(css, importCssRE, async (match) => {
    const [matched, rawUrl] = match
    return await doImportCSSReplace(rawUrl, matched, replacer)
  })
}

const asyncReplace = async (
  input: string,
  re: RegExp,
  replacer: (match: RegExpExecArray) => string | Promise<string>
): Promise<string> => {
  let match: RegExpExecArray | null
  let remaining = input
  let rewritten = ''
  while ((match = re.exec(remaining))) {
    rewritten += remaining.slice(0, match.index)
    rewritten += await replacer(match)
    remaining = remaining.slice(match.index + match[0].length)
  }
  rewritten += remaining
  return rewritten
}

const doImportCSSReplace = async (
  rawUrl: string,
  matched: string,
  replacer: CssUrlReplacer
) => {
  let wrap = ''
  const first = rawUrl[0]
  if (first === `"` || first === `'`) {
    wrap = first
    rawUrl = rawUrl.slice(1, -1)
  }
  if (isExternalUrl(rawUrl) || isDataUrl(rawUrl) || rawUrl.startsWith('#')) {
    return matched
  }

  return `@import ${wrap}${await replacer(rawUrl)}${wrap}`
}

export const externalRE = /^(https?:)?\/\//
export const isExternalUrl = (url: string): boolean => externalRE.test(url)

export const dataUrlRE = /^\s*data:/i
export const isDataUrl = (url: string): boolean => dataUrlRE.test(url)
