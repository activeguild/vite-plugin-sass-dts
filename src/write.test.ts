import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  formatExportType,
  formatExportTypeFileName,
  formatWriteFileName,
  formatWriteFilePath,
  getReplacerResult,
  writeToFile,
} from './write'

describe('getReplacerResult', () => {
  it('returns the replacement string as is', () => {
    expect(
      getReplacerResult('style.module.scss', { replacement: 'MyType' })
    ).toBe('MyType')
  })

  it('calls a replacement function with the file name', () => {
    expect(
      getReplacerResult('style.module.scss', {
        replacement: (fileName) => `T_${fileName}`,
      })
    ).toBe('T_style.module.scss')
  })

  it('returns undefined without a replacer', () => {
    expect(getReplacerResult('style.module.scss')).toBeUndefined()
  })
})

describe('formatExportType', () => {
  it('formats a readonly type entry with the key as the type', () => {
    expect(formatExportType('foo')).toBe(`  readonly 'foo': 'foo';`)
  })

  it('uses the given type name', () => {
    expect(formatExportType('foo', 'MyType')).toBe(`  readonly 'foo': MyType;`)
  })
})

describe('formatWriteFileName', () => {
  it('keeps existing d.ts file names', () => {
    expect(formatWriteFileName('/a/style.module.scss.d.ts')).toBe(
      '/a/style.module.scss.d.ts'
    )
  })

  it('generates the TypeScript 5 format by default', () => {
    expect(formatWriteFileName('/a/style.module.scss')).toBe(
      '/a/style.module.d.scss.ts'
    )
    expect(formatWriteFileName('/a/style.module.css')).toBe(
      '/a/style.module.d.css.ts'
    )
    expect(formatWriteFileName('/a/style.module.sass')).toBe(
      '/a/style.module.d.sass.ts'
    )
  })

  it('generates the legacy format when requested', () => {
    expect(formatWriteFileName('/a/style.module.scss', true)).toBe(
      '/a/style.module.scss.d.ts'
    )
  })

  it('falls back to appending .d.ts for unknown extensions', () => {
    expect(formatWriteFileName('/a/style.module.pcss')).toBe(
      '/a/style.module.pcss.d.ts'
    )
  })
})

describe('formatWriteFilePath', () => {
  it('replaces sourceDir with outputDir', () => {
    expect(
      formatWriteFilePath('/src/style.module.scss', {
        sourceDir: '/src',
        outputDir: '/dist',
      })
    ).toBe('/dist/style.module.d.scss.ts')
  })

  it('throws when sourceDir or outputDir is not absolute', () => {
    expect(() =>
      formatWriteFilePath('/src/style.module.scss', {
        sourceDir: 'src',
        outputDir: '/dist',
      })
    ).toThrow('sourceDir must be an absolute path')
    expect(() =>
      formatWriteFilePath('/src/style.module.scss', {
        sourceDir: '/src',
        outputDir: 'dist',
      })
    ).toThrow('outputDir must be an absolute path')
  })
})

describe('formatExportTypeFileName', () => {
  it('strips the .ts suffix and directories', () => {
    expect(formatExportTypeFileName('/a/b/global.d.ts')).toBe('global.d')
  })
})

describe('writeToFile', () => {
  const prettierOptions = { filepath: '*.d.ts' }

  it('writes a d.ts file next to the source file', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'vite-plugin-sass-dts-'))
    const fileName = path.join(dir, 'style.module.scss')
    const outFile = path.join(dir, 'style.module.d.scss.ts')

    await writeToFile(
      prettierOptions,
      fileName,
      new Map([
        ['Root', true],
        ['Root_active', true],
      ])
    )

    // writeToFile does not await the writeFile callback, so wait for content
    const content = await vi.waitFor(() => {
      const written = readFileSync(outFile, 'utf-8')
      expect(written).not.toBe('')
      return written
    })
    // prettier normalizes quotes and unquotes valid identifier keys
    expect(content).toContain(`readonly Root: "Root";`)
    expect(content).toContain(`readonly Root_active: "Root_active";`)
    expect(content).toContain('export = classNames;')
  })

  it('uses esm export and named exports when configured', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'vite-plugin-sass-dts-'))
    const fileName = path.join(dir, 'style.module.scss')
    const outFile = path.join(dir, 'style.module.d.scss.ts')

    await writeToFile(prettierOptions, fileName, new Map([['foo', true]]), {
      esmExport: true,
      useNamedExport: true,
      exportName: { replacement: 'styles' },
    })

    const content = await vi.waitFor(() => {
      const written = readFileSync(outFile, 'utf-8')
      expect(written).not.toBe('')
      return written
    })
    expect(content).toContain('declare const styles:')
    expect(content).toContain('export default styles;')
    expect(content).toContain(`export const foo: "foo";`)
  })

  it('formats with biome when the formatter option is set', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'vite-plugin-sass-dts-'))
    const fileName = path.join(dir, 'style.module.scss')
    const outFile = path.join(dir, 'style.module.d.scss.ts')

    await writeToFile(prettierOptions, fileName, new Map([['foo', true]]), {
      formatter: 'biome',
    })

    const content = await vi.waitFor(() => {
      const written = readFileSync(outFile, 'utf-8')
      expect(written).not.toBe('')
      return written
    })
    // biome defaults to tab indentation, which proves biome ran
    expect(content).toMatch(/\treadonly foo: "foo";/)
    expect(content).toContain('export = classNames;')
  })
})
