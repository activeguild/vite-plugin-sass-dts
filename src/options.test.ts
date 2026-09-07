import { describe, expect, it } from 'vitest'
import { getParseCase, getPreprocessorOptions } from './options'
import { toCamelCase, toDashCase } from './util'
import type { FinalConfig } from './type'

const configWith = (localsConvention?: string) =>
  ({
    css: localsConvention ? { modules: { localsConvention } } : undefined,
    resolve: { alias: [] },
  }) as unknown as FinalConfig

describe('getParseCase', () => {
  it('returns toCamelCase for camelCase conventions', () => {
    expect(getParseCase(configWith('camelCase'))).toBe(toCamelCase)
    expect(getParseCase(configWith('camelCaseOnly'))).toBe(toCamelCase)
  })

  it('returns toDashCase for dashes conventions', () => {
    expect(getParseCase(configWith('dashes'))).toBe(toDashCase)
    expect(getParseCase(configWith('dashesOnly'))).toBe(toDashCase)
  })

  it('returns undefined when no convention is configured', () => {
    expect(getParseCase(configWith())).toBeUndefined()
    expect(getParseCase(configWith('asIs'))).toBeUndefined()
  })
})

describe('getPreprocessorOptions', () => {
  it('falls back to resolve.alias when scss options are missing', () => {
    const alias = [{ find: '@', replacement: '/src' }]
    const config = {
      css: {},
      resolve: { alias },
    } as unknown as FinalConfig
    expect(getPreprocessorOptions(config)).toEqual({
      additionalData: undefined,
      includePaths: undefined,
      importer: undefined,
      alias,
    })
  })

  it('returns the configured scss options', () => {
    const scss = { additionalData: '$color: red;', api: 'legacy' }
    const config = {
      css: { preprocessorOptions: { scss } },
      resolve: { alias: [] },
    } as unknown as FinalConfig
    expect(getPreprocessorOptions(config)).toBe(scss)
  })
})
