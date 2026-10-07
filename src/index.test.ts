import { describe, expect, it } from 'vitest'
import Plugin from './index'

describe('Plugin', () => {
  it('is named vite-plugin-sass-dts', () => {
    expect(Plugin().name).toBe('vite-plugin-sass-dts')
  })

  it('exposes the given options through api.options', () => {
    const options = { esmExport: true, useNamedExport: true }

    expect(Plugin(options).api.options).toBe(options)
  })

  it('exposes an empty options object by default', () => {
    expect(Plugin().api.options).toEqual({})
  })
})
