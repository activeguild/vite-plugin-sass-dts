import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { resolveConfig } from 'vite'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { main } from './main'
import { writeToFile } from './write'
import { SourceMapConsumer } from 'source-map-js'
import { parseCss } from './css'
import {
  extractClassNamePositions,
  generateDtsSourceMap,
  resolveOriginalPositions,
} from './sourcemap'
import type { FinalConfig } from './type'
import { toCamelCase } from './util'

describe('extractClassNamePositions', () => {
  it('records the generated position of each class selector', () => {
    const css = [
      '.header-1 {',
      '  color: blue;',
      '}',
      '.header-1.active {',
      '  color: red;',
      '}',
      '@media (min-width: 768px) {',
      '  .input {',
      '    max-width: 370px;',
      '  }',
      '}',
    ].join('\n')

    const positions = extractClassNamePositions(css)

    // lines are 1-based, columns 0-based (source map convention)
    expect(positions.get('header-1')).toEqual({ line: 1, column: 0 })
    expect(positions.get('active')).toEqual({ line: 4, column: 0 })
    expect(positions.get('input')).toEqual({ line: 8, column: 2 })
  })

  it('keeps the first occurrence when a class appears in multiple rules', () => {
    const css = '.foo {\n  color: red;\n}\n.foo {\n  color: blue;\n}\n'
    const positions = extractClassNamePositions(css)
    expect(positions.get('foo')).toEqual({ line: 1, column: 0 })
  })

  it('applies the parse case transform to keys', () => {
    const css = '.header-item {\n  color: red;\n}\n'
    const positions = extractClassNamePositions(css, toCamelCase)
    expect(positions.get('headerItem')).toEqual({ line: 1, column: 0 })
    expect(positions.has('header-item')).toBe(false)
  })

  it('ignores selectors without classes and keyframe steps', () => {
    const css =
      '#id {\n  color: red;\n}\n@keyframes spin {\n  0% {\n    opacity: 0;\n  }\n}\n'
    const positions = extractClassNamePositions(css)
    expect(positions.size).toBe(0)
  })
})

describe('parseCss source map output (modern api)', () => {
  let root: string

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'sass-dts-smap-'))
    fs.mkdirSync(path.join(root, 'src'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'src', 'App.module.scss'),
      '.header-1 {\n  color: blue;\n  &.active {\n    color: red;\n  }\n}\n'
    )
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  const getConfig = async () => {
    const resolved = await resolveConfig(
      { configFile: false, logLevel: 'error', root },
      'serve'
    )
    return resolved as unknown as FinalConfig
  }

  it('returns the full generated css, raw source map and entry line offset', async () => {
    const config = await getConfig()
    const fileName = path.join(root, 'src', 'App.module.scss')
    const result = await parseCss(
      fs.readFileSync(fileName),
      fileName,
      config,
      true
    )

    expect(result.css).toContain('.header-1')
    expect(result.sourceMap?.sources).toContain(pathToFileURL(fileName).href)
    // data = '\n' + SPLIT_STR + <file content> → 2 lines prepended
    expect(result.entryLineOffset).toBe(2)
  })

  it('resolves generated class positions back to the scss source', async () => {
    const config = await getConfig()
    const fileName = path.join(root, 'src', 'App.module.scss')
    const entryUrl = pathToFileURL(fileName).href
    const result = await parseCss(
      fs.readFileSync(fileName),
      fileName,
      config,
      true
    )

    const generated = extractClassNamePositions(result.css as string)
    const original = resolveOriginalPositions(
      generated,
      result.sourceMap!,
      entryUrl,
      result.entryLineOffset!
    )

    // .header-1 is on line 1, &.active on line 3 of App.module.scss
    expect(original.get('header-1')).toEqual({
      source: entryUrl,
      line: 1,
      column: 0,
    })
    expect(original.get('active')).toEqual({
      source: entryUrl,
      line: 3,
      column: 2,
    })
  })
})

describe('generateDtsSourceMap', () => {
  const dtsPath = '/project/src/App.module.d.scss.ts'
  const scssUrl = pathToFileURL('/project/src/App.module.scss').href
  const positions = new Map([
    ['header-1', { source: scssUrl, line: 1, column: 0 }],
    ['active', { source: scssUrl, line: 3, column: 2 }],
  ])

  it('maps each readonly key line back to the scss selector', () => {
    const dts = [
      'declare const classNames: {',
      "  readonly 'header-1': 'header-1';",
      "  readonly active: 'active';",
      '};',
      'export = classNames;',
      '',
    ].join('\n')

    const map = generateDtsSourceMap(dts, dtsPath, positions)
    expect(map).toBeDefined()

    const parsed = JSON.parse(map as string)
    expect(parsed.file).toBe('App.module.d.scss.ts')
    expect(parsed.sources).toEqual(['./App.module.scss'])

    const consumer = new SourceMapConsumer(parsed)
    // column of the key token start ("'header-1'" is at index 11)
    expect(consumer.originalPositionFor({ line: 2, column: 11 })).toMatchObject(
      { source: 'App.module.scss', line: 1, column: 0 }
    )
    expect(consumer.originalPositionFor({ line: 3, column: 11 })).toMatchObject(
      { source: 'App.module.scss', line: 3, column: 2 }
    )
  })

  it('maps named export lines as well', () => {
    const dts = [
      'declare const classNames: {',
      "  readonly active: 'active';",
      '};',
      'export = classNames;',
      "export const active: 'active';",
      '',
    ].join('\n')

    const map = generateDtsSourceMap(dts, dtsPath, positions)
    const consumer = new SourceMapConsumer(JSON.parse(map as string))
    expect(consumer.originalPositionFor({ line: 5, column: 13 })).toMatchObject(
      { source: 'App.module.scss', line: 3, column: 2 }
    )
  })

  it('returns undefined when no key has a position', () => {
    const dts = "declare const classNames: {\n  readonly other: 'other';\n};\n"
    expect(generateDtsSourceMap(dts, dtsPath, positions)).toBeUndefined()
  })

  it('emits sources relative to the d.ts location', () => {
    const map = generateDtsSourceMap(
      "declare const classNames: {\n  readonly active: 'active';\n};\n",
      '/project/types/App.module.d.scss.ts',
      positions
    )
    expect(JSON.parse(map as string).sources).toEqual([
      '../src/App.module.scss',
    ])
  })
})

describe('writeToFile with the sourceMap option', () => {
  let root: string

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'sass-dts-smap-write-'))
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  const keys = new Map([['header-1', true]])
  const prettierOptions = { filepath: '*.d.ts' }

  const makeCase = (name: string) => {
    const dir = path.join(root, name)
    fs.mkdirSync(dir, { recursive: true })
    const scss = path.join(dir, 'App.module.scss')
    fs.writeFileSync(scss, '.header-1 {\n  color: blue;\n}\n')
    return {
      scss,
      dts: path.join(dir, 'App.module.d.scss.ts'),
      positions: new Map([
        ['header-1', { source: pathToFileURL(scss).href, line: 1, column: 0 }],
      ]),
    }
  }

  it("writes a .map file and a sourceMappingURL comment with 'file'", async () => {
    const c = makeCase('filemode')
    await writeToFile(
      prettierOptions,
      c.scss,
      keys,
      { sourceMap: 'file' },
      c.positions
    )

    const dtsPath = c.dts
    const content = await vi.waitFor(() => {
      const written = fs.readFileSync(dtsPath, 'utf-8')
      if (!written.includes('sourceMappingURL')) throw new Error('wait')
      return written
    })
    expect(content).toContain('//# sourceMappingURL=App.module.d.scss.ts.map')

    const map = await vi.waitFor(() =>
      JSON.parse(fs.readFileSync(`${dtsPath}.map`, 'utf-8'))
    )
    expect(map.file).toBe('App.module.d.scss.ts')
    expect(map.sources).toEqual(['./App.module.scss'])
  })

  it("embeds a base64 data uri with 'inline'", async () => {
    const c = makeCase('inlinemode')
    await writeToFile(
      prettierOptions,
      c.scss,
      keys,
      { sourceMap: 'inline' },
      c.positions
    )

    const dtsPath = c.dts
    const content = await vi.waitFor(() => {
      const written = fs.readFileSync(dtsPath, 'utf-8')
      if (!written.includes('sourceMappingURL=data:')) throw new Error('wait')
      return written
    })
    const match = content.match(
      /\/\/# sourceMappingURL=data:application\/json;base64,(\S+)/
    )
    expect(match).not.toBeNull()
    const map = JSON.parse(
      Buffer.from((match as RegExpMatchArray)[1], 'base64').toString('utf-8')
    )
    expect(map.sources).toEqual(['./App.module.scss'])
    expect(fs.existsSync(`${dtsPath}.map`)).toBe(false)
  })

  it('writes no comment or map file without the option', async () => {
    const c = makeCase('plain')
    await writeToFile(prettierOptions, c.scss, keys, {}, c.positions)

    const content = await vi.waitFor(() => {
      const written = fs.readFileSync(c.dts, 'utf-8')
      if (!written.includes('classNames')) throw new Error('wait')
      return written
    })
    expect(content).not.toContain('sourceMappingURL')
    expect(fs.existsSync(`${c.dts}.map`)).toBe(false)
  })
})

describe('main() end-to-end with sourceMap', () => {
  let root: string

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'sass-dts-smap-e2e-'))
    fs.mkdirSync(path.join(root, 'src'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'src', 'App.module.scss'),
      '.header-1 {\n  color: blue;\n  &.active {\n    color: red;\n  }\n}\n'
    )
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('writes a d.ts whose declaration map points at the scss selectors', async () => {
    const resolved = await resolveConfig(
      { configFile: false, logLevel: 'error', root },
      'serve'
    )
    const config = Object.assign(resolved, {
      prettierOptions: { filepath: '*.d.ts' },
    }) as unknown as FinalConfig

    const fileName = path.join(root, 'src', 'App.module.scss')
    main(fileName, config, { sourceMap: 'file' })

    const dtsPath = path.join(root, 'src', 'App.module.d.scss.ts')
    const content = await vi.waitFor(
      () => {
        const written = fs.readFileSync(dtsPath, 'utf-8')
        if (!written.includes('sourceMappingURL')) throw new Error('wait')
        return written
      },
      { timeout: 5000 }
    )
    expect(content).toContain('//# sourceMappingURL=App.module.d.scss.ts.map')

    const map = await vi.waitFor(() =>
      JSON.parse(fs.readFileSync(`${dtsPath}.map`, 'utf-8'))
    )
    expect(map.sources).toEqual(['./App.module.scss'])

    const consumer = new SourceMapConsumer(map)
    const lines = content.split('\n')
    const headerRe = /readonly (['"]?)header-1\1/
    const activeRe = /readonly (['"]?)active\1/
    const headerLine = lines.findIndex((l) => headerRe.test(l)) + 1
    const activeLine = lines.findIndex((l) => activeRe.test(l)) + 1
    expect(headerLine).toBeGreaterThan(0)
    expect(activeLine).toBeGreaterThan(0)
    // key token start (including the quote when the key is quoted)
    const keyCol = (line: string, key: string) => {
      const index = line.indexOf(key)
      return /['"]/.test(line[index - 1] ?? '') ? index - 1 : index
    }
    const headerCol = keyCol(lines[headerLine - 1], 'header-1')
    const activeCol = keyCol(lines[activeLine - 1], 'active')

    expect(
      consumer.originalPositionFor({ line: headerLine, column: headerCol })
    ).toMatchObject({ source: 'App.module.scss', line: 1 })
    expect(
      consumer.originalPositionFor({ line: activeLine, column: activeCol })
    ).toMatchObject({ source: 'App.module.scss', line: 3 })
  })
})

describe('main() with additionalData and a global d.ts', () => {
  let root: string

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'sass-dts-smap-global-'))
    fs.mkdirSync(path.join(root, 'src', 'assets', 'styles'), {
      recursive: true,
    })
    fs.writeFileSync(
      path.join(root, 'src', 'assets', 'styles', '_index.scss'),
      '$primary: #333;\n.row {\n  display: flex;\n}\n'
    )
    fs.writeFileSync(
      path.join(root, 'src', 'App.module.scss'),
      '.header-1 {\n  color: common.$primary;\n}\n'
    )
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('offsets entry positions past additionalData and maps global keys to the imported scss', async () => {
    const resolved = await resolveConfig(
      {
        configFile: false,
        logLevel: 'error',
        root,
        resolve: {
          alias: [{ find: '@', replacement: path.join(root, 'src') }],
        },
        css: {
          preprocessorOptions: {
            scss: {
              // two lines, so the entry offset differs from the default of 2
              additionalData: `@use "@/assets/styles" as common;\n$unused: 0;`,
            },
          },
        },
      },
      'serve'
    )
    const config = Object.assign(resolved, {
      prettierOptions: { filepath: '*.d.ts' },
    }) as unknown as FinalConfig

    const globalDts = path.join(root, 'src', 'style.d.ts')
    const fileName = path.join(root, 'src', 'App.module.scss')
    main(fileName, config, {
      sourceMap: 'file',
      global: { generate: true, outputFilePath: globalDts },
    })

    // local d.ts: header-1 must still map to line 1 of App.module.scss
    const dtsPath = path.join(root, 'src', 'App.module.d.scss.ts')
    const localMap = await vi.waitFor(
      () => JSON.parse(fs.readFileSync(`${dtsPath}.map`, 'utf-8')),
      { timeout: 5000 }
    )
    expect(localMap.sources).toEqual(['./App.module.scss'])
    const localContent = fs.readFileSync(dtsPath, 'utf-8')
    const localLine =
      localContent.split('\n').findIndex((l) => l.includes('header-1')) + 1
    const localConsumer = new SourceMapConsumer(localMap)
    const traced = localConsumer.originalPositionFor({
      line: localLine,
      column: localContent.split('\n')[localLine - 1].indexOf('header-1') - 1,
    })
    expect(traced).toMatchObject({ source: 'App.module.scss', line: 1 })

    // global d.ts: row must map into the imported _index.scss (line 2)
    const globalMap = await vi.waitFor(
      () => JSON.parse(fs.readFileSync(`${globalDts}.map`, 'utf-8')),
      { timeout: 5000 }
    )
    expect(globalMap.sources).toEqual(['./assets/styles/_index.scss'])
    const globalContent = fs.readFileSync(globalDts, 'utf-8')
    const globalLine =
      globalContent.split('\n').findIndex((l) => /readonly.*row/.test(l)) + 1
    const globalLineText = globalContent.split('\n')[globalLine - 1]
    const rowIndex = globalLineText.indexOf('row')
    const rowCol = /['"]/.test(globalLineText[rowIndex - 1] ?? '')
      ? rowIndex - 1
      : rowIndex
    const globalConsumer = new SourceMapConsumer(globalMap)
    const rowTraced = globalConsumer.originalPositionFor({
      line: globalLine,
      column: rowCol,
    })
    expect(rowTraced).toMatchObject({
      source: 'assets/styles/_index.scss',
      line: 2,
    })
  })
})
