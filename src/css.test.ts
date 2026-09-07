import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveConfig } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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

// Repro for https://github.com/activeguild/vite-plugin-sass-dts/issues/108
describe('parseCss with modern api (issue #108)', () => {
  let root: string

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'sass-dts-108-'))
    // aliased directory
    fs.mkdirSync(path.join(root, 'styles'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'styles', '_utils.scss'),
      '$color: red;\n.from-alias { color: $color; }\n'
    )
    // fake node_modules package whose "main" points at a JS file
    const pkgDir = path.join(root, 'node_modules', 'fake-sass-pkg')
    fs.mkdirSync(pkgDir, { recursive: true })
    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({
        name: 'fake-sass-pkg',
        version: '1.0.0',
        main: 'index.js',
      })
    )
    fs.writeFileSync(path.join(pkgDir, 'index.js'), 'module.exports = {}')
    fs.writeFileSync(
      path.join(pkgDir, '_index.scss'),
      '.from-pkg { color: blue; }\n'
    )
    fs.mkdirSync(path.join(root, 'src'), { recursive: true })
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  const getConfig = async (scss: Record<string, unknown>) => {
    const resolved = await resolveConfig(
      {
        configFile: false,
        logLevel: 'error',
        root,
        resolve: {
          alias: [
            { find: '@styles', replacement: path.join(root, 'styles') },
            {
              find: '@pkg',
              replacement: path.join(root, 'node_modules', 'fake-sass-pkg'),
            },
          ],
        },
        css: { preprocessorOptions: { scss } },
      },
      'serve'
    )
    return resolved as unknown as FinalConfig
  }

  it('resolves @use with a vite alias (modern)', async () => {
    const config = await getConfig({ api: 'modern' })
    const scss = `@use '@styles/utils' as u;\n.local { color: u.$color; }\n`
    const fileName = path.join(root, 'src', 'app.module.scss')
    const result = await parseCss(Buffer.from(scss), fileName, config)
    expect(result.localStyle).toContain('.local')
  })

  it('resolves bare package @use via node_modules (modern)', async () => {
    const config = await getConfig({ api: 'modern' })
    const scss = `@use 'fake-sass-pkg';\n.local { color: green; }\n`
    const fileName = path.join(root, 'src', 'app.module.scss')
    const result = await parseCss(Buffer.from(scss), fileName, config)
    expect(result.localStyle).toContain('.local')
  })

  it('resolves @use with a vite alias pointing at a package dir (modern)', async () => {
    const config = await getConfig({ api: 'modern' })
    const scss = `@use '@pkg' as p;\n.local { color: green; }\n`
    const fileName = path.join(root, 'src', 'app.module.scss')
    const result = await parseCss(Buffer.from(scss), fileName, config)
    expect(result.localStyle).toContain('.local')
  })

  it('resolves bare package @use via node_modules (modern-compiler)', async () => {
    const config = await getConfig({ api: 'modern-compiler' })
    const scss = `@use 'fake-sass-pkg';\n.local { color: green; }\n`
    const fileName = path.join(root, 'src', 'app.module.scss')
    const result = await parseCss(Buffer.from(scss), fileName, config)
    expect(result.localStyle).toContain('.local')
  })

  it('honors includePaths from a legacy config under the modern api', async () => {
    const config = await getConfig({
      api: 'modern',
      includePaths: [path.join(root, 'styles')],
    })
    const scss = `@use 'utils' as u;\n.local { color: u.$color; }\n`
    const fileName = path.join(root, 'src', 'app.module.scss')
    const result = await parseCss(Buffer.from(scss), fileName, config)
    expect(result.localStyle).toContain('.local')
  })
})
