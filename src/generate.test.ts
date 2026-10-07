import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { generateDts } from './generate'
import type { FinalConfig } from './type'

const createConfig = (
  root: string,
  overrides: Record<string, unknown> = {}
): FinalConfig =>
  ({
    root,
    resolve: { alias: [] },
    createResolver: () => async () => null,
    prettierOptions: { filepath: '*.d.ts' },
    ...overrides,
  }) as unknown as FinalConfig

const createFixture = (fileName: string, source: string) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'vite-plugin-sass-dts-gen-'))
  const file = path.join(dir, fileName)
  writeFileSync(file, source)
  return { dir, file }
}

describe('generateDts', () => {
  it('returns the d.ts for a scss module without writing it', async () => {
    const { dir, file } = createFixture(
      'style.module.scss',
      '.Root { width: 1rem; &_active { color: red; } }'
    )

    const files = await generateDts(file, createConfig(dir), {})

    expect(files).toHaveLength(1)
    expect(files[0].path).toBe(path.join(dir, 'style.module.d.scss.ts'))
    expect(files[0].content).toContain(`readonly Root: "Root";`)
    expect(files[0].content).toContain(`readonly Root_active: "Root_active";`)
    expect(existsSync(files[0].path)).toBe(false)
  })

  it('reads plain css modules without sass', async () => {
    const { dir, file } = createFixture(
      'style.module.css',
      '.foo { color: red; }'
    )

    const files = await generateDts(file, createConfig(dir), {})

    expect(files[0].path).toBe(path.join(dir, 'style.module.d.css.ts'))
    expect(files[0].content).toContain(`readonly foo: "foo";`)
  })

  it('applies localsConvention', async () => {
    const { dir, file } = createFixture(
      'style.module.css',
      '.foo-bar { color: red; }'
    )
    const config = createConfig(dir, {
      css: { modules: { localsConvention: 'camelCaseOnly' } },
    })

    const files = await generateDts(file, config, {})

    expect(files[0].content).toContain(`readonly fooBar: "fooBar";`)
  })

  it('also returns the global d.ts when global.generate is enabled', async () => {
    const { dir, file } = createFixture(
      'style.module.scss',
      '.local { color: red; }'
    )
    const outputFilePath = path.join(dir, 'style.d.ts')
    const config = createConfig(dir, {
      css: {
        preprocessorOptions: {
          scss: { additionalData: '.global { color: blue; }' },
        },
      },
    })

    const files = await generateDts(file, config, {
      global: { generate: true, outputFilePath },
    })

    expect(files.map((f) => f.path)).toEqual([
      path.join(dir, 'style.module.d.scss.ts'),
      outputFilePath,
    ])
    expect(files[0].content).toContain('typeof globalClassNames &')
    expect(files[0].content).toContain(`readonly local: "local";`)
    expect(files[1].content).toContain(`readonly global: "global";`)
    expect(files[1].content).not.toContain('local')
  })

  it('rejects when the source file does not exist', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'vite-plugin-sass-dts-gen-'))

    await expect(
      generateDts(path.join(dir, 'missing.module.scss'), createConfig(dir), {})
    ).rejects.toThrow()
  })
})
