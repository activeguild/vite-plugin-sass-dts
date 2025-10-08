import Sass from 'sass-embedded'
import { getPreprocessorOptions } from './options'
import type { AdditionalData, CSS, CssUrlReplacer, FinalConfig } from './type'
import { createRequire } from 'node:module'
import { Alias, normalizePath } from 'vite'
import path from 'path'
import fs from 'fs'
import { importCssRE } from './util'
import { pathToFileURL, fileURLToPath } from 'node:url'

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
    extensions: ['.scss', '.sass', '.pcss', '.css'],
    mainFields: ['sass', 'style'],
    tryIndex: true,
    tryPrefix: '_',
    preferRelative: true,
  })

  const internalImporter: Sass.LegacyImporter<'async'> = (
    url,
    importer,
    done
  ) => {
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

  const data = await getData(file.toString(), fileName, options.additionalData)
  if (options.api === 'legacy') {
    // Legacy API
    const finalImporter: Sass.LegacyAsyncImporter[] = []

    if (options.importer) {
      Array.isArray(options.importer)
        ? finalImporter.push(...options.importer)
        : finalImporter.push(options.importer)
    }

    finalImporter.push(internalImporter)

    const result = await new Promise<Sass.LegacyResult>((resolve, reject) => {
      sass.render(
        {
          ...options,
          data,
          file: fileName,
          includePaths: ['node_modules'],
          importer: finalImporter,
          indentedSyntax: fileName.endsWith('.sass'),
        },
        (err: Error, res: Sass.LegacyResult) => {
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
  } else {
    // Modern API (modern / modern-compiler)
    const finalImporters: Sass.Importer<'async'>[] = []

    // User-provided importers first (with legacy findFileUrl support)
    if (options.importers) {
      const userImporters = Array.isArray(options.importers)
        ? options.importers
        : [options.importers]

      for (const importer of userImporters) {
        // Support legacy findFileUrl (used by older Vite configs)
        if (
          'findFileUrl' in importer &&
          typeof importer.findFileUrl === 'function'
        ) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const legacyImporter = importer as any
          finalImporters.push({
            canonicalize: async (
              url: string,
              context: Sass.CanonicalizeContext
            ) => {
              const result = await legacyImporter.findFileUrl(url, {
                fromImport: context.fromImport,
              })
              return result || null
            },
            load: async (canonicalUrl: URL) => {
              let filePath = canonicalUrl.pathname

              // If it's a directory, try to find index file
              if (
                fs.existsSync(filePath) &&
                fs.statSync(filePath).isDirectory()
              ) {
                const indexFiles = [
                  '_index.scss',
                  'index.scss',
                  '_index.sass',
                  'index.sass',
                ]
                for (const indexFile of indexFiles) {
                  const indexPath = path.join(filePath, indexFile)
                  if (fs.existsSync(indexPath)) {
                    filePath = indexPath
                    break
                  }
                }
              }

              const contents = fs.readFileSync(filePath, 'utf-8')
              return {
                contents,
                syntax: filePath.endsWith('.sass') ? 'indented' : 'scss',
                sourceMapUrl: pathToFileURL(filePath),
              } as Sass.ImporterResult
            },
          })
        } else {
          finalImporters.push(importer)
        }
      }
    }

    // Add internal importer for additionalData resolution as fallback
    const internalModernImporter: Sass.Importer<'async'> = {
      canonicalize: async (url: string, context: Sass.CanonicalizeContext) => {
        if (url.startsWith('file://')) return null

        const importer = context.containingUrl
          ? fileURLToPath(context.containingUrl)
          : fileName

        const resolved = await resolveFn(url, importer)

        if (
          resolved &&
          (resolved.endsWith('.css') ||
            resolved.endsWith('.scss') ||
            resolved.endsWith('.sass'))
        ) {
          return pathToFileURL(resolved)
        }
        return null
      },
      load: async (canonicalUrl: URL) => {
        const filePath = fileURLToPath(canonicalUrl)
        const ext = path.extname(filePath)
        let syntax: Sass.Syntax = 'scss'
        if (ext === '.sass') {
          syntax = 'indented'
        } else if (ext === '.css') {
          syntax = 'css'
        }

        const result = await rebaseUrls(
          filePath,
          fileName,
          config.resolve.alias,
          '$'
        )
        const contents =
          result && 'contents' in result
            ? result.contents
            : fs.readFileSync(
                result && 'file' in result ? result.file : filePath,
                'utf-8'
              )
        return { contents, syntax, sourceMapUrl: canonicalUrl }
      },
    }

    finalImporters.push(internalModernImporter)

    const sassOptions: Sass.StringOptions<'async'> = {
      ...options,
      url: pathToFileURL(fileName),
      importers: finalImporters,
      syntax: fileName.endsWith('.sass') ? 'indented' : 'scss',
    }

    const result = await sass.compileStringAsync(data, sassOptions)
    const splitted = result.css.toString().split(SPLIT_STR)
    return { localStyle: splitted[1] || '', globalStyle: splitted[0] }
  }
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
    const fallbackPaths = _require.resolve.paths?.('sass-embedded') || []
    const resolved = _require.resolve('sass-embedded', {
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
): Promise<Sass.LegacyImporterResult> => {
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
