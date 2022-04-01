import path from 'path'
import type { SassException } from 'sass'

export const cssLangs = `\\.(css|sass|scss)($|\\?)`
export const cssLangReg = new RegExp(cssLangs)
export const cssModuleReg = new RegExp(`\\.module${cssLangs}`)

export const isCSSRequest = (request: string): boolean =>
  cssLangReg.test(request)

export const isCSSModuleRequest = (request: string): boolean =>
  cssModuleReg.test(request)

export const getRelativePath = (
  from: string | undefined,
  to: string | undefined
) => path.relative(path.dirname(from || ''), path.dirname(to || '')) || './'

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

export const isSassException = (e: any): e is SassException => 'file' in e
