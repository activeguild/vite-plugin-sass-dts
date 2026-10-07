# PR1: 生成処理の共通基盤 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 型ファイルの「生成」と「書き込み」を分離し、生成内容を `await` で受け取れるようにする（CLI / check モード / Declaration map の前提）。既存ユーザーの出力は変えない。

**Architecture:** `generateDts()` が書き込みなしで `{ path, content }[]` を返し、`writeGeneratedFiles()` が差分のあるファイルだけを書き込む。プラグインは `main()` 経由でこの 2 つを呼ぶ。prettier 設定の解決は `createFinalConfig()` に切り出し、プラグインのオプションは `api.options` で外から読めるようにする。

**Tech Stack:** TypeScript, Vite plugin API, sass-embedded, postcss / postcss-js, prettier / biome, vitest

**仕様:** `docs/superpowers/specs/2026-10-06-cli-and-declaration-map-design.md` の「1. 共通基盤」

---

## 事前の注意

- この環境では `npx` と `npm` が壊れている（pnpm 管理の Node のパスが存在しない）。コマンドは `./node_modules/.bin/<tool>` で直接実行すること。
- husky の pre-commit（中身は `npx lint-staged` だけ）も `npx` を使うため失敗する。また lint-staged の設定は `eslint . --fix` / `prettier . --write` とリポジトリ全体を対象にしており、手動で実行すると README やロックファイルまで書き換えてしまう。そのため各タスクのコミットは、**コミットする ts ファイルだけ**に eslint と prettier をかけてから `--no-verify` で行う。

```bash
./node_modules/.bin/eslint --fix <ts files>
./node_modules/.bin/prettier --write <ts files>
git add <files>
git commit --no-verify -m "<message>"
git status --short   # 既存の未追跡ファイル 2 つ以外に変更が残っていないこと
```

  eslint がエラーを出した場合はコミットせず、原因を直してからやり直す。以降の各タスクの「コミットする」ステップはすべてこの手順で行う。
- 着手前の基準値：`./node_modules/.bin/vitest run` が 59 件すべて成功し、`./node_modules/.bin/tsc --noEmit -p .` もエラーなし。
- 既存の挙動として、prettier 設定の解決に `config.root`（ディレクトリ）を渡しているため、プロジェクト直下の `.prettierrc` は読まれない。**この PR では挙動を変えない**（別タスクで対応する）。
- 作業ブランチ：`docs/cli-and-declaration-map-spec` から `feat/generate-foundation` を切って作業する。

```bash
git checkout -b feat/generate-foundation
```

## ファイル構成

| ファイル | 種別 | 責務 |
| --- | --- | --- |
| `src/type.ts` | 変更 | `GeneratedFile` 型を追加 |
| `src/write.ts` | 変更 | `buildDtsContent()`（文字列生成＋整形）と `writeGeneratedFiles()`（差分書き込み）に分割。`writeToFile()` は両者を呼ぶ薄いラッパーとして残す |
| `src/generate.ts` | 新規 | `generateDts()`：ソース読み込み → CSS 化 → クラス名抽出 → 型ファイル内容の生成。書き込みはしない |
| `src/main.ts` | 変更 | `generateDts()` → `writeGeneratedFiles()` を呼ぶだけの async 関数にする |
| `src/config.ts` | 新規 | `createFinalConfig()`：Vite の `ResolvedConfig` に prettier 設定を足して `FinalConfig` にする |
| `src/index.ts` | 変更 | `createFinalConfig()` を使う。`api: { options }` を公開する。`main()` は fire-and-forget のまま |
| `src/write.test.ts` | 変更 | `buildDtsContent` / `writeGeneratedFiles` のテストを追加 |
| `src/generate.test.ts` | 新規 | `generateDts` のテスト |
| `src/main.test.ts` | 新規 | `main` のテスト |
| `src/config.test.ts` | 新規 | `createFinalConfig` のテスト |
| `src/index.test.ts` | 新規 | プラグインの `name` / `api.options` のテスト |
| `tools/regen-example-dts.mjs` | 新規 | example の vite.config をそのまま使い、プラグインのフック経由で型ファイルを再生成する検証用スクリプト |

---

### Task 0: リファクタ前の出力を基準値として保存する

「出力を1文字も変えない」を `toContain` ではなくバイト単位で確認するため、変更前のプラグインで example の型ファイルを生成して保存しておく。`example/react-sass/node_modules/vite-plugin-sass-dts` はリポジトリ直下へのシンボリックリンクなので、`dist` をビルドすればそれが使われる。

**Files:**
- Create: `tools/regen-example-dts.mjs`

- [ ] **Step 1: 再生成スクリプトを作成する**

`tools/regen-example-dts.mjs` を作成する（`vite` をリポジトリ直下の `node_modules` から解決するため、`tools/` に置く）。変更前のプラグインにも `api` がないので、`configResolved` と `transform` のフックを直接呼ぶ。生成は完了を待たない作りなので、最後に 3 秒待つ。

```js
// Regenerates the example's d.ts files through the plugin's public hooks.
// Usage (cwd = example/react-sass): node ../../tools/regen-example-dts.mjs
import { resolveConfig } from 'vite'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const config = await resolveConfig(
  { configFile: path.join(root, 'vite.config.ts'), root },
  'serve'
)
const plugin = config.plugins.find((p) => p.name === 'vite-plugin-sass-dts')
await plugin.configResolved.call({}, config)

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
const files = walk(path.join(root, 'src')).filter((f) =>
  /\.module\.(scss|sass|css)$/.test(f)
)
for (const f of files) await plugin.transform.call({}, '', f)

// Generation is fire-and-forget inside the plugin, so wait for the writes.
await new Promise((r) => setTimeout(r, 3000))
console.log('regenerated from', files.length, 'module files')
```

- [ ] **Step 2: 変更前のコードで dist をビルドし、基準値を保存する**

Sass の deprecation warning が大量に出るので、出力は捨てる。

```bash
./node_modules/.bin/tsup src/index.ts --format esm,cjs --dts --clean --shims > /dev/null
(cd example/react-sass && node ../../tools/regen-example-dts.mjs > /dev/null 2>&1)
mkdir -p "$TMPDIR/sass-dts-golden"
cp example/react-sass/src/App.module.d.scss.ts example/react-sass/src/User/User.module.d.scss.ts example/react-sass/src/@types/style.d.ts "$TMPDIR/sass-dts-golden/"
ls "$TMPDIR/sass-dts-golden"
```

Expected: `App.module.d.scss.ts`、`User.module.d.scss.ts`、`style.d.ts` の 3 ファイルがある。`git status --short example` に、既存の未追跡ファイル（`App.module.d.scss.ts`、`User.module.d.scss.ts`）以外の変更が出ていないこと。

- [ ] **Step 3: スクリプトをコミットする**

```bash
git add tools/regen-example-dts.mjs
./node_modules/.bin/lint-staged
git commit --no-verify -m "chore: Add a script to regenerate the example d.ts files"
```

---

### Task 1: `GeneratedFile` 型と `buildDtsContent()`

**Files:**
- Modify: `src/type.ts`
- Modify: `src/write.ts`
- Test: `src/write.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/write.test.ts` の import に `buildDtsContent` を追加し、ファイル末尾に次を追加する。

```ts
describe('buildDtsContent', () => {
  const prettierOptions = { filepath: '*.d.ts' }

  it('returns the formatted d.ts content without writing a file', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'vite-plugin-sass-dts-'))
    const fileName = path.join(dir, 'style.module.scss')

    const content = await buildDtsContent(
      prettierOptions,
      fileName,
      new Map([['Root', true]])
    )

    expect(content).toContain(`readonly Root: "Root";`)
    expect(content).toContain('export = classNames;')
    expect(existsSync(path.join(dir, 'style.module.d.scss.ts'))).toBe(false)
  })

  it('imports the global class names when global.outputFilePath is set', async () => {
    const content = await buildDtsContent(
      prettierOptions,
      '/project/src/App.module.scss',
      new Map([['foo', true]]),
      {
        global: {
          generate: true,
          outputFilePath: '/project/src/style.d.ts',
        },
      }
    )

    expect(content).toContain(`import globalClassNames from "./style.d";`)
    expect(content).toContain('typeof globalClassNames &')
  })
})
```

あわせて先頭の import を次のように変更する。

```ts
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
```

```ts
import {
  buildDtsContent,
  formatExportType,
  formatExportTypeFileName,
  formatWriteFileName,
  formatWriteFilePath,
  getReplacerResult,
  writeToFile,
} from './write'
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `./node_modules/.bin/vitest run src/write.test.ts`
Expected: FAIL（`buildDtsContent` が export されていない、または関数ではない）

- [ ] **Step 3: `GeneratedFile` 型を追加する**

`src/type.ts` の `export type CSS = ...` の直後に追加する。

```ts
export type GeneratedFile = { path: string; content: string }
```

- [ ] **Step 4: `buildDtsContent()` を実装し、`writeToFile()` をラッパーにする**

`src/write.ts` の先頭から `writeToFile` の定義の終わり（`writeFile(writePath, ...)` のブロックを含む）までを次に置き換える。`getReplacerResult` 以降の関数は変更しない。

```ts
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, basename, isAbsolute } from 'node:path'
import { type Options } from 'prettier'
import type { ContentReplacer, GeneratedFile, PluginOptions } from './type'
import { formatContent } from './format'
import { getRelativePath } from './util'
import path from 'path'

export const buildDtsContent = async (
  prettierOptions: Options,
  fileName: string,
  classNameKeys: Map<string, boolean>,
  options?: PluginOptions
): Promise<string> => {
  const baseName = path.basename(fileName)
  const typeName = getReplacerResult(baseName, options?.typeName)
  const exportName =
    getReplacerResult(baseName, options?.exportName) ?? 'classNames'
  let exportTypes = ''
  let namedExports = ''
  const exportStyle = options?.esmExport
    ? `export default ${exportName};`
    : `export = ${exportName};`
  for (const classNameKey of classNameKeys.keys()) {
    exportTypes = `${exportTypes}\n${formatExportType(classNameKey, typeName)}`
    namedExports = `${namedExports}\nexport const ${classNameKey}: '${
      typeName ?? classNameKey
    }';`
  }

  let outputFileString = ''
  if (options?.global?.outputFilePath) {
    const relativePath = getRelativePath(
      dirname(fileName),
      dirname(options.global.outputFilePath)
    )
    const exportTypeFileName = formatExportTypeFileName(
      options.global.outputFilePath
    )
    outputFileString = `import globalClassNames from '${relativePath}${exportTypeFileName}'\n`
    outputFileString = `${outputFileString}declare const ${exportName}: typeof globalClassNames & {${exportTypes}\n};\n${exportStyle}`
    if (options?.useNamedExport) {
      outputFileString = `${outputFileString}\n${namedExports}\n\n`
    }
  } else {
    outputFileString = `declare const ${exportName}: {${exportTypes}\n};\n${exportStyle}`
    if (options?.useNamedExport) {
      outputFileString = `${outputFileString}\n\n${namedExports}`
    }
  }

  return formatContent(
    outputFileString,
    formatWriteFilePath(fileName, options),
    prettierOptions,
    options?.formatter
  )
}

export const writeToFile = async (
  prettierOptions: Options,
  fileName: string,
  classNameKeys: Map<string, boolean>,
  options?: PluginOptions
) => {
  const content = await buildDtsContent(
    prettierOptions,
    fileName,
    classNameKeys,
    options
  )
  await writeGeneratedFiles([
    { path: formatWriteFilePath(fileName, options), content },
  ])
}

export const writeGeneratedFiles = async (files: GeneratedFile[]) => {
  await Promise.all(
    files.map(async ({ path: filePath, content }) => {
      const current = await readFile(filePath, 'utf-8').catch(() => undefined)
      if (current === content) {
        return
      }
      await ensureDirectoryExists(filePath)
      await writeFile(filePath, content)
    })
  )
}
```

ファイル末尾の `ensureDirectoryExists` は `mkdir` を `node:fs/promises` から import したものをそのまま使う（既存の `import { mkdir } from 'node:fs/promises'` の行は上の import に統合したので削除する）。

```ts
export const ensureDirectoryExists = async (file: string) => {
  await mkdir(dirname(file), { recursive: true })
}
```

補足：変更前の `writeToFile` はコールバック版の `writeFile` を `await` していなかったが、今回から書き込み完了まで待つようになる。既存テストの `vi.waitFor` はそのまま通る。

- [ ] **Step 5: テストが通ることを確認する**

Run: `./node_modules/.bin/vitest run src/write.test.ts`
Expected: PASS（既存テストを含めすべて成功）

- [ ] **Step 6: コミットする**

```bash
git add src/type.ts src/write.ts src/write.test.ts
git commit -m "refactor: Split d.ts content building from file writing"
```

---

### Task 2: `writeGeneratedFiles()` のテスト

Task 1 で実装済みの `writeGeneratedFiles()` の振る舞いをテストで固定する。

**Files:**
- Test: `src/write.test.ts`

- [ ] **Step 1: テストを書く**

`src/write.test.ts` の import に `writeGeneratedFiles` を追加し、`node:fs` の import を次にする。

```ts
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
```

ファイル末尾に追加する。

```ts
describe('writeGeneratedFiles', () => {
  it('creates missing directories and writes each file', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'vite-plugin-sass-dts-'))
    const a = path.join(dir, 'nested', 'a.d.scss.ts')
    const b = path.join(dir, 'b.d.ts')

    await writeGeneratedFiles([
      { path: a, content: 'A' },
      { path: b, content: 'B' },
    ])

    expect(readFileSync(a, 'utf-8')).toBe('A')
    expect(readFileSync(b, 'utf-8')).toBe('B')
  })

  it('does not touch a file whose content is unchanged', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'vite-plugin-sass-dts-'))
    const file = path.join(dir, 'a.d.scss.ts')
    writeFileSync(file, 'same')
    const old = new Date('2020-01-01T00:00:00Z')
    utimesSync(file, old, old)

    await writeGeneratedFiles([{ path: file, content: 'same' }])

    expect(statSync(file).mtimeMs).toBe(old.getTime())
  })

  it('overwrites a file whose content changed', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'vite-plugin-sass-dts-'))
    const file = path.join(dir, 'a.d.scss.ts')
    writeFileSync(file, 'old')

    await writeGeneratedFiles([{ path: file, content: 'new' }])

    expect(readFileSync(file, 'utf-8')).toBe('new')
  })
})
```

- [ ] **Step 2: テストが通ることを確認する**

Run: `./node_modules/.bin/vitest run src/write.test.ts`
Expected: PASS

もし失敗した場合は、Task 1 Step 4 の `writeGeneratedFiles` の実装を見直す（テストを緩めて合わせない）。

- [ ] **Step 3: コミットする**

```bash
git add src/write.test.ts
git commit -m "test: Cover writeGeneratedFiles"
```

---

### Task 3: `generateDts()`

**Files:**
- Create: `src/generate.ts`
- Test: `src/generate.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/generate.test.ts` を作成する。

```ts
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
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `./node_modules/.bin/vitest run src/generate.test.ts`
Expected: FAIL（`./generate` が見つからない）

- [ ] **Step 3: `generateDts()` を実装する**

`src/generate.ts` を作成する。中身は既存の `main()` の処理を、書き込みなしで値を返す形にしたもの。グローバル型ファイルに渡すオプション（`esmExport` と `formatter` だけ）も、既存の挙動と同じにする。

```ts
import { readFile } from 'node:fs/promises'
import { parse } from 'postcss'
import { objectify } from 'postcss-js'
import { parseCss } from './css'
import { extractClassNameKeys } from './extract'
import { getParseCase } from './options'
import type { CSS, FinalConfig, GeneratedFile, PluginOptions } from './type'
import { buildDtsContent, formatWriteFilePath } from './write'

export const generateDts = async (
  fileName: string,
  config: FinalConfig,
  option: PluginOptions
): Promise<GeneratedFile[]> => {
  const file = await readFile(fileName)
  const css: CSS = fileName.endsWith('.css')
    ? { localStyle: file.toString() }
    : await parseCss(file, fileName, config)
  const toParseCase = getParseCase(config)
  const classNameKeys = extractClassNameKeys(
    objectify(parse(css.localStyle)),
    toParseCase
  )

  const files: GeneratedFile[] = [
    {
      path: formatWriteFilePath(fileName, option),
      content: await buildDtsContent(
        config.prettierOptions,
        fileName,
        classNameKeys,
        option
      ),
    },
  ]

  if (
    !!css.globalStyle &&
    option.global?.generate &&
    option.global?.outputFilePath
  ) {
    const globalOption: PluginOptions = {
      esmExport: option.esmExport,
      formatter: option.formatter,
    }
    const globalClassNameKeys = extractClassNameKeys(
      objectify(parse(css.globalStyle)),
      toParseCase
    )
    files.push({
      path: formatWriteFilePath(option.global.outputFilePath, globalOption),
      content: await buildDtsContent(
        config.prettierOptions,
        option.global.outputFilePath,
        globalClassNameKeys,
        globalOption
      ),
    })
  }

  return files
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `./node_modules/.bin/vitest run src/generate.test.ts`
Expected: PASS（5 件）

- [ ] **Step 5: コミットする**

```bash
git add src/generate.ts src/generate.test.ts
git commit -m "feat: Add generateDts that returns d.ts contents without writing"
```

---

### Task 4: `main()` を `generateDts` + `writeGeneratedFiles` に置き換える

**Files:**
- Modify: `src/main.ts`
- Test: `src/main.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/main.test.ts` を作成する。

```ts
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
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `./node_modules/.bin/vitest run src/main.test.ts`
Expected: FAIL（1 件目は、現在の `main` が書き込みを待たずに返るため、ファイルがまだ存在せず `ENOENT` になる）

- [ ] **Step 3: `main()` を書き換える**

`src/main.ts` 全体を次に置き換える。

- Sass の例外については、既存の挙動（`e.name !== fileName` のときだけログを出す）を維持する。
- それ以外の例外は、これまで何も出さずに握りつぶしていたが、今回から `console.error` に出す。

```ts
import { generateDts } from './generate'
import type { FinalConfig, PluginOptions } from './type'
import { isSassException } from './util'
import { writeGeneratedFiles } from './write'

export const main = async (
  fileName: string,
  config: FinalConfig,
  option: PluginOptions
): Promise<void> => {
  try {
    const files = await generateDts(fileName, config, option)
    await writeGeneratedFiles(files)
  } catch (e) {
    if (isSassException(e)) {
      if (e.name !== fileName) {
        console.error('e :>> ', e)
      }
    } else {
      console.error('e :>> ', e)
    }
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `./node_modules/.bin/vitest run src/main.test.ts`
Expected: PASS（2 件）

- [ ] **Step 5: コミットする**

```bash
git add src/main.ts src/main.test.ts
git commit -m "refactor: Make main await generation and writing"
```

---

### Task 5: `createFinalConfig()`

**Files:**
- Create: `src/config.ts`
- Test: `src/config.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/config.test.ts` を作成する。

```ts
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
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `./node_modules/.bin/vitest run src/config.test.ts`
Expected: FAIL（`./config` が見つからない）

- [ ] **Step 3: `createFinalConfig()` を実装する**

`src/config.ts` を作成する。中身は `src/index.ts` の `configResolved` にある処理をそのまま移したもの。

```ts
import prettier from 'prettier'
import type { ResolvedConfig } from 'vite'
import type { FinalConfig, PluginOptions } from './type'

const { resolveConfig, resolveConfigFile } = prettier

export const createFinalConfig = async (
  config: ResolvedConfig,
  option: PluginOptions
): Promise<FinalConfig> => {
  const configPath = option.prettierFilePath
    ? await resolveConfigFile(option.prettierFilePath)
    : null
  const prettierOptions =
    (await resolveConfig(configPath || config.root, {
      config: configPath || undefined,
    })) || {}
  return {
    ...config,
    prettierOptions: { ...prettierOptions, filepath: '*.d.ts' },
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `./node_modules/.bin/vitest run src/config.test.ts`
Expected: PASS（2 件）

- [ ] **Step 5: コミットする**

```bash
git add src/config.ts src/config.test.ts
git commit -m "refactor: Extract createFinalConfig from the plugin"
```

---

### Task 6: プラグイン本体の更新（`createFinalConfig` の利用と `api.options` の公開）

**Files:**
- Modify: `src/index.ts`
- Test: `src/index.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/index.test.ts` を作成する。

```ts
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
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `./node_modules/.bin/vitest run src/index.test.ts`
Expected: FAIL（`api` が undefined）

- [ ] **Step 3: `src/index.ts` を書き換える**

`src/index.ts` 全体を次に置き換える。

- prettier 関連の import を削除し、`createFinalConfig` を使う。
- `transform` と `handleHotUpdate` では、これまでどおり生成の完了を待たない（`void main(...)`）。変更前の `transform` も `main()` が即座に `undefined` を返していたので、Vite から見た挙動は同じ。

```ts
import { Plugin as VitePlugin, createFilter } from 'vite'
import { createFinalConfig } from './config'
import { main } from './main'
import type { FinalConfig, PluginOptions } from './type'
import { isCSSModuleRequest } from './util'

export type SassDtsPluginApi = { options: PluginOptions }

export default function Plugin(
  option: PluginOptions = {}
): VitePlugin<SassDtsPluginApi> & { api: SassDtsPluginApi } {
  let cacheConfig: FinalConfig
  let filter: ReturnType<typeof createFilter>
  const enabledMode = option.enabledMode || ['development']
  return {
    name: 'vite-plugin-sass-dts',
    api: { options: option },
    async configResolved(config) {
      filter = createFilter(undefined, option.excludePath)
      cacheConfig = await createFinalConfig(config, option)
    },
    handleHotUpdate(context) {
      if (!isCSSModuleRequest(context.file) || !filter(context.file)) return
      void main(context.file, cacheConfig, option)
      return
    },
    transform(code, id) {
      const fileName = id.replace(/(?:\?|&)(used|direct|inline|vue).*/, '')
      if (
        !enabledMode.includes(cacheConfig.env.MODE) ||
        !isCSSModuleRequest(fileName) ||
        !filter(id)
      ) {
        // returning undefined will signal vite that the file has not been transformed
        // avoiding warnings about source maps not being generated
        return undefined
      }

      // Generation runs in the background so it never blocks the transform.
      void main(fileName, cacheConfig, option)
      return undefined
    },
    watchChange(id) {
      if (isCSSModuleRequest(id) && filter(id)) {
        this.addWatchFile(id)
      }
    },
  }
}
```

- [ ] **Step 4: テストと型チェックが通ることを確認する**

Run: `./node_modules/.bin/vitest run src/index.test.ts && ./node_modules/.bin/tsc --noEmit -p .`
Expected: テストは PASS（3 件）、tsc はエラーなし

`VitePlugin<SassDtsPluginApi>` で型エラーになる場合（Vite の `Plugin` 型が型引数を取らないバージョンの場合）は、戻り値の型を `VitePlugin & { api: SassDtsPluginApi }` にする。

- [ ] **Step 5: コミットする**

```bash
git add src/index.ts src/index.test.ts
git commit -m "feat: Expose plugin options via api and use createFinalConfig"
```

---

### Task 7: 全体の検証

**Files:** なし（確認のみ）

- [ ] **Step 1: すべてのテストを実行する**

Run: `./node_modules/.bin/vitest run`
Expected: すべて PASS。59 件（既存）＋新規 17 件（buildDtsContent 2、writeGeneratedFiles 3、generateDts 5、main 2、createFinalConfig 2、Plugin 3）＝ 76 件。

- [ ] **Step 2: 型チェック・lint・ビルドを実行する**

Run: `./node_modules/.bin/tsc --noEmit -p . && ./node_modules/.bin/eslint src --ext .ts && ./node_modules/.bin/tsup src/index.ts --format esm,cjs --dts --clean --shims`
Expected: すべてエラーなし。`dist/index.js`、`dist/index.cjs`、`dist/index.d.ts` が生成される。

- [ ] **Step 3: 既存の出力が変わっていないことをバイト単位で確認する**

Step 2 で新しいコードの dist をビルド済みなので、Task 0 と同じスクリプトで再生成し、基準値と比較する。

```bash
rm example/react-sass/src/App.module.d.scss.ts example/react-sass/src/User/User.module.d.scss.ts example/react-sass/src/@types/style.d.ts
(cd example/react-sass && node ../../tools/regen-example-dts.mjs > /dev/null 2>&1)
diff "$TMPDIR/sass-dts-golden/App.module.d.scss.ts" example/react-sass/src/App.module.d.scss.ts
diff "$TMPDIR/sass-dts-golden/User.module.d.scss.ts" example/react-sass/src/User/User.module.d.scss.ts
diff "$TMPDIR/sass-dts-golden/style.d.ts" example/react-sass/src/@types/style.d.ts
git status --short example
```

Expected:
- 3 つの `diff` がいずれも何も出力しない（終了コード 0）。
- `git status` には、既存の未追跡ファイル 2 つ（`?? example/react-sass/src/App.module.d.scss.ts` と `?? example/react-sass/src/User/User.module.d.scss.ts`）だけが出る。

差分が出た場合は、どのタスクの変更が原因かを特定して直す。基準値のほうを書き換えて合わせてはいけない。

最初に `rm` するのは、Task 0 の後もファイルが残っていると、生成されなかった場合でも差分なしに見えてしまうため。未追跡ファイルはコミットしない。

- [ ] **Step 4: 完了報告**

結果をユーザーに報告する。PR を作る場合は、説明に次を含める。

- 生成と書き込みの分離
- `api.options` の公開
- Sass 以外の例外も `console.error` に出すようにした挙動変更
- `writeToFile` が書き込み完了まで待つようになった点
