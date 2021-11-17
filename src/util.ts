import path from 'path'

export const cssLangs = `\\.(css|sass|scss)($|\\?)`
export const cssLangReg = new RegExp(cssLangs)

export const isCSSRequest = (request: string): boolean =>
  cssLangReg.test(request)

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
  target.toLowerCase().replace(/[-_ ./~ ][a-z]/g, (v) => {
    return v.slice(1).toUpperCase()
  })
