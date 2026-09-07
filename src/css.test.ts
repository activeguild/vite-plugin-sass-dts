import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isDataUrl, isExternalUrl, parseCss } from './css'
import type { FinalConfig } from './type'

describe('isExternalUrl', () => {
  it('matches http(s) and protocol-relative urls', () => {
    expect(isExternalUrl('https://example.com/a.css')).toBe(true)
    expect(isExternalUrl('http://example.com/a.css')).toBe(true)
    expect(isExternalUrl('//example.com/a.css')).toBe(true)
  })

  it('does not match relative or absolute paths', () => {
    expect(isExternalUrl('./a.css')).toBe(false)
    expect(isExternalUrl('/a.css')).toBe(false)
  })
})

describe('isDataUrl', () => {
  it('matches data urls', () => {
    expect(isDataUrl('data:text/css,body{}')).toBe(true)
    expect(isDataUrl('  data:text/css,body{}')).toBe(true)
  })

  it('does not match other urls', () => {
    expect(isDataUrl('./a.css')).toBe(false)
  })
})

describe('parseCss', () => {
  const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..'
  )
  const config = {
    root: projectRoot,
    resolve: { alias: [] },
    createResolver: () => async () => null,
  } as unknown as FinalConfig

  it('compiles scss and resolves ampersand nesting', async () => {
    const scss = `.Root {
  width: 1rem;

  &_active {
    color: red;
  }
}`
    const result = await parseCss(
      Buffer.from(scss),
      path.join(projectRoot, 'style.module.scss'),
      config
    )

    expect(result.localStyle).toContain('.Root')
    expect(result.localStyle).toContain('.Root_active')
  })

  it('splits global style injected via additionalData', async () => {
    const configWithAdditionalData = {
      ...config,
      css: {
        preprocessorOptions: {
          scss: { additionalData: '.global { color: blue; }' },
        },
      },
    } as unknown as FinalConfig

    const result = await parseCss(
      Buffer.from('.local { color: red; }'),
      path.join(projectRoot, 'style.module.scss'),
      configWithAdditionalData
    )

    expect(result.globalStyle).toContain('.global')
    expect(result.localStyle).toContain('.local')
    expect(result.localStyle).not.toContain('.global')
  })
})
