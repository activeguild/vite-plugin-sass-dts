import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { ResolvedConfig } from 'vite'
import { describe, expect, it } from 'vitest'
import { createFinalConfig } from './config'

describe('createFinalConfig', () => {
  it('keeps the vite config and forces the d.ts filepath', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'vite-plugin-sass-dts-cfg-'))
    const config = { root: dir, mode: 'development' } as ResolvedConfig

    const finalConfig = await createFinalConfig(config, {})

    expect(finalConfig.root).toBe(dir)
    expect(finalConfig.mode).toBe('development')
    expect(finalConfig.prettierOptions.filepath).toBe('*.d.ts')
  })

  it('loads the prettier config given by prettierFilePath', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'vite-plugin-sass-dts-cfg-'))
    const prettierFilePath = path.join(dir, '.prettierrc')
    writeFileSync(prettierFilePath, JSON.stringify({ semi: false }))
    const config = { root: dir } as ResolvedConfig

    const finalConfig = await createFinalConfig(config, { prettierFilePath })

    expect(finalConfig.prettierOptions).toMatchObject({
      semi: false,
      filepath: '*.d.ts',
    })
  })
})
