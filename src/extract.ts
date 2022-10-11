import { collectionToObj } from './util'
import type { CSSJSObj, GetParseCaseFunction } from './type'

const importRe = new RegExp(/^(@import)/)
const keySeparatorRe = new RegExp(/(?=[\s.:[\]><+,()])/g)

export const extractClassNameKeys = (
  obj: CSSJSObj,
  toParseCase: GetParseCaseFunction,
  parentKey?: string
): Map<string, boolean> => {
  return Object.entries(obj).reduce<Map<string, boolean>>(
    (curr, [key, value]) => {
      if (importRe.test(key)) return curr
      const splitKeys = key.split(keySeparatorRe)
      for (const splitKey of splitKeys) {
        if (parentKey === ':export' || splitKey.startsWith('.')) {
          if (toParseCase) {
            curr.set(toParseCase(splitKey.replace('.', '').trim()), true)
          } else {
            curr.set(splitKey.replace('.', '').trim(), true)
          }
        }
      }

      if (typeof value === 'object' && Object.keys(value).length > 0) {
        const valueToExtract = Array.isArray(value)
          ? collectionToObj(value)
          : value
        const map = extractClassNameKeys(valueToExtract, toParseCase, key)

        for (const key of map.keys()) {
          if (toParseCase) {
            curr.set(toParseCase(key), true)
          } else {
            curr.set(key, true)
          }
        }
      }

      return curr
    },
    new Map()
  )
}
