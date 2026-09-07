import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatContent } from './format'

const content = `declare const classNames: {  readonly 'Root': 'Root';  readonly 'Root_active': 'Root_active';};export = classNames;`

describe('formatContent', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('formats with prettier by default', async () => {
    const formatted = await formatContent(
      content,
      '/a/style.module.d.scss.ts',
      {
        filepath: '*.d.ts',
      }
    )
    expect(formatted).toContain(`  readonly Root: "Root";`)
    expect(formatted).toContain('export = classNames;')
  })

  it('formats with biome when configured', async () => {
    const formatted = await formatContent(
      content,
      '/a/style.module.d.scss.ts',
      { filepath: '*.d.ts' },
      'biome'
    )
    // biome defaults to tab indentation, which proves biome ran
    expect(formatted).toMatch(/\treadonly Root: "Root";/)
    expect(formatted).toContain('export = classNames;')
  })

  it('falls back to the unformatted content on biome diagnostics', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const broken = 'declare const classNames: {;;;'
    const formatted = await formatContent(
      broken,
      '/a/style.module.d.scss.ts',
      { filepath: '*.d.ts' },
      'biome'
    )
    expect(formatted).toBe(broken)
    expect(consoleError).toHaveBeenCalled()
  })

  it('throws a helpful error when biome is not installed', async () => {
    vi.resetModules()
    vi.doMock('@biomejs/js-api/nodejs', () => {
      throw new Error('Cannot find module')
    })
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const { formatContent: freshFormatContent } = await import('./format')
    await expect(
      freshFormatContent(content, '/a/style.module.d.scss.ts', {}, 'biome')
    ).rejects.toThrow(
      `Did you install '@biomejs/js-api' and '@biomejs/wasm-nodejs'?`
    )
    expect(consoleError).toHaveBeenCalled()
    vi.doUnmock('@biomejs/js-api/nodejs')
    vi.resetModules()
  })
})
