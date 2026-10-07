import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { main } from './main'
import type { FinalConfig } from './type'

const createConfig = (root: string): FinalConfig =>
  ({
    root,
    resolve: { alias: [] },
    createResolver: () => async () => null,
    prettierOptions: { filepath: '*.d.ts' },
  }) as unknown as FinalConfig

describe('main', () => {
  it('writes the generated d.ts once the returned promise resolves', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'vite-plugin-sass-dts-main-'))
    const file = path.join(dir, 'style.module.scss')
    writeFileSync(file, '.Root { color: red; }')

    await main(file, createConfig(dir), {})

    expect(
      readFileSync(path.join(dir, 'style.module.d.scss.ts'), 'utf-8')
    ).toContain(`readonly Root: "Root";`)
  })

  it('logs and resolves instead of throwing on a missing file', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'vite-plugin-sass-dts-main-'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      main(path.join(dir, 'missing.module.scss'), createConfig(dir), {})
    ).resolves.toBeUndefined()

    expect(error).toHaveBeenCalled()
    expect(existsSync(path.join(dir, 'missing.module.d.scss.ts'))).toBe(false)
    error.mockRestore()
  })
})
