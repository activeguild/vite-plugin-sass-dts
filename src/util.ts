import path from 'node:path'
import type { Exception } from 'sass-embedded'

export const cssLangs = `\\.(css|pcss|sass|scss)($|\\?)`
export const cssLangReg = new RegExp(cssLangs)
export const cssModuleReg = new RegExp(`\\.module${cssLangs}`)
export const importCssRE = /@import ('[^']+\.css'|"[^"]+\.css"|[^'")]+\.css)/
export const sameDirRE = /^[./]/

export const isCSSRequest = (request: string): boolean =>
  cssLangReg.test(request)

export const isCSSModuleRequest = (request: string): boolean =>
  cssModuleReg.test(request)

export const getRelativePath = (
  from: string | undefined,
  to: string | undefined
) => {
  let relativePath = path.relative(from || '', to || '') || './'
  if (path.sep !== '/') {
    relativePath = relativePath.replaceAll(path.sep, '/')
  }
  relativePath = sameDirRE.test(relativePath)
    ? relativePath
    : `./${relativePath}`

  return !relativePath.endsWith('/') ? `${relativePath}/` : relativePath
}

export const toDashCase = (target: string) =>
  target
    .replace(/[-_ /~ . ][A-z0-9]/g, (v) => {
      return '-' + v.slice(1)
    })
    .toLowerCase()

export const toCamelCase = (target: string) =>
  target
    .replace(/^[A-Z]/, (m) => m.toLowerCase())
    .replace(/[-_ ./~ ]+([A-z0-9])/g, (m, $1) => $1.toUpperCase())

export const isSassException = (e: unknown): e is Exception =>
  typeof e === 'object' && !!e && 'file' in e

export const collectionToObj = <V>(collection: Record<string, V>[]) => {
  return collection.reduce((acc, item): Record<string, V> => {
    return { ...acc, ...item }
  }, {})
}

// Regular expression to match embedded source map comments
export const sourceMapRE =
  /\/\*#\s*sourceMappingURL=data:application\/json[^*]*\*\//g

export const extractSourceMapComment = (css: string): string | null => {
  const match = css.match(sourceMapRE)
  return match ? match[match.length - 1] : null
}
