import { collectionToObj } from './util'
import type { CSSJSObj, GetParseCaseFunction } from './type'

// [Note]: @apply for Tailwind
const importRe = new RegExp(/^(@import|@apply)/)
const supportRe = new RegExp(/^(@support)/)
const keySeparatorRe = new RegExp(/(?=[\s.:[\]><+,()])/g)

// Resolves `&` in nested selectors (e.g. `&_active` under `.Root` -> `.Root_active`).
// Sass resolves `&` at compile time, so this only applies to plain css modules.
const resolveNestedSelector = (key: string, parentKey?: string): string => {
  if (
    !parentKey ||
    parentKey === ':export' ||
    parentKey.startsWith('@') ||
    !key.includes('&')
  ) {
    return key
  }

  const parentSelectors = parentKey
    .split(',')
    .map((selector) => selector.trim())

  return key
    .split(',')
    .flatMap((selector) =>
      parentSelectors.map((parentSelector) =>
        selector.trim().replaceAll('&', parentSelector)
      )
    )
    .join(',')
}

export const extractClassNameKeys = (
  obj: CSSJSObj,
  toParseCase: GetParseCaseFunction,
  parentKey?: string
): Map<string, boolean> => {
  return Object.entries(obj).reduce<Map<string, boolean>>(
    (curr, [key, value]) => {
      if (importRe.test(key)) return curr
      const resolvedKey = resolveNestedSelector(key, parentKey)
      const splitKeys = resolvedKey.split(keySeparatorRe)

      if (!supportRe.test(key)) {
        for (const splitKey of splitKeys) {
          if (parentKey === ':export' || splitKey.startsWith('.')) {
            if (toParseCase) {
              curr.set(toParseCase(splitKey.replace('.', '').trim()), true)
            } else {
              curr.set(splitKey.replace('.', '').trim(), true)
            }
          }
        }
      }

      if (typeof value === 'object' && Object.keys(value).length > 0) {
        const valueToExtract = Array.isArray(value)
          ? collectionToObj(value)
          : value
        const map = extractClassNameKeys(
          valueToExtract,
          toParseCase,
          key.startsWith('@') ? parentKey : resolvedKey
        )

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
