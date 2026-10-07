# CLI / check モード と Declaration map 設計

- 作成日: 2026-10-06
- 対象: vite-plugin-sass-dts 1.3.39 以降

## 目的

1. dev サーバーで scss を保存しないと型が生成されない問題を解消し、clone 直後や CI でも型を揃えられるようにする（CLI と check モード）。
2. 生成方式のまま、言語サーバー方式の最大の利点である「定義へ移動で scss にジャンプ」を実現する（Declaration map）。

## 実装順序

3 つの PR に分けて、次の順に進める。

1. 共通基盤リファクタ
2. CLI と check モード
3. Declaration map

## 1. 共通基盤：生成と書き込みを分ける

### 現状の問題

- `main()` は `fs.readFile`、`writeToFile()` は `fs.writeFile` をコールバックで使っていて、`await` できない。
- 生成した内容が呼び出し元に返らないため、比較（check）や位置情報の受け渡し（map）ができない。

### 変更内容

- `src/generate.ts` を新設する。
  - `generateDts(fileName: string, config: FinalConfig, option: PluginOptions): Promise<GeneratedFile[]>`（既存の `main()` と同じ引数順）
  - `type GeneratedFile = { path: string; content: string }`
  - ソースの読み込みと内容生成だけを行い、書き込みはしない。
  - グローバル型ファイルを生成する設定（`global.generate` と `global.outputFilePath`）の場合は、その内容も戻り値に含める。
- `src/write.ts` を分割する。
  - `buildDtsContent(...)`：型ファイルの文字列を組み立て、整形（prettier / biome）まで済ませて返す。
  - `writeGeneratedFiles(files: GeneratedFile[])`：`fs/promises` で書き込む。既存の内容と同じならスキップする。
  - `formatWriteFilePath` などの既存ヘルパーはそのまま残す。
- `src/index.ts` の `configResolved` にある prettier 設定の解決処理を、`createFinalConfig(config, option): Promise<FinalConfig>` として切り出す。
- `main()` は `generateDts` と `writeGeneratedFiles` を順に呼ぶだけにする。エラーは現状と同じくログに出す。
- プラグインに `api: { options: PluginOptions }` を追加し、CLI からオプションを取得できるようにする。

### 制約

- 既存ユーザーの出力内容は変えない。既存のテストは変更なしで通ること。

## 2. CLI と check モード

### コマンド

```bash
npx vite-plugin-sass-dts generate [--clean] [--config <path>] [--mode <mode>] [--root <dir>]
npx vite-plugin-sass-dts check    [--config <path>] [--mode <mode>] [--root <dir>]
```

- `package.json` に `bin` を追加する。エントリは `src/cli.ts` とし、tsup のエントリに加える。
- `--mode` の既定値は `development`。

### 設定の読み込み

- Vite の `resolveConfig({ configFile, root, mode }, 'serve')` でユーザーの vite.config を解決する。
- `config.plugins` から `name === 'vite-plugin-sass-dts'` のプラグインを探し、`api.options` をプラグインオプションとして使う。
- 見つからなければエラーメッセージを出して終了コード 2 で終了する。
- `createFinalConfig` で `FinalConfig` を作り、プラグインと同じ生成処理を使う。
- CLI は明示的に実行するものなので、`enabledMode` は参照しない。

### 対象ファイルの探索

- `config.root` から再帰的にたどる。
- 除外するもの：`node_modules`、`.git`、`config.build.outDir`、`option.outputDir`。
- 対象：`isCSSModuleRequest` に一致し、`excludePath` のフィルタを通るファイル。
- 同時に処理するのは 8 ファイルまでとする。
- グローバル型ファイルはパスで重複を除き、1 回だけ扱う。

### check の判定

| 種別 | 条件 |
| --- | --- |
| missing | 生成されるべきファイルが存在しない |
| outdated | 既存ファイルの内容が生成結果とバイト単位で一致しない |
| orphan | 生成ファイル名のパターンに一致するが、元のソースが存在しない |

- 生成ファイル名のパターンは次のとおり。
  - `*.module.d.{scss,sass,css}.ts`
  - レガシー形式の `*.module.{scss,sass,css}.d.ts`
  - 上記それぞれの `.map`
- 元のソースのパスは `formatWriteFilePath` の逆変換で求める（`outputDir` / `sourceDir` を考慮する）。
- 孤児を探す範囲は、`outputDir` があればその配下、なければ探索対象と同じ範囲とする。
- `declarationMap` が有効なら `.map` も比較対象に含める。

### 出力と終了コード

- 1 行に 1 件ずつ `missing: <path>` / `outdated: <path>` / `orphan: <path>` の形式で出力する。
- 終了コード
  - 0：差分なし
  - 1：差分あり、または Sass のコンパイルエラーあり。エラーがあっても他のファイルの処理は続け、最後にまとめて報告する。
  - 2：設定エラーなどで処理を続けられない

### generate

- すべての対象ファイルについて生成し、書き込む（内容が同じならスキップ）。
- `--clean` を付けたときだけ孤児ファイルを削除する。付けなければ何も削除しない。
- Sass のコンパイルエラーがあれば終了コード 1 にする。

## 3. Declaration map

### オプション

- `declarationMap?: boolean`（既定値 `false`）。有効にすると、型ファイルと同じ場所に `<型ファイル名>.map` を出力する。

### 実現性の確認

TypeScript 5.4 の tsserver で、`.d.scss.ts` と `.scss.d.ts` の両方で確認済み。

- 確認した条件：型ファイルに `//# sourceMappingURL=` を付け、`.map` の `sources` に scss を指定した。
- 結果：「定義へ移動」で scss の該当行にジャンプした。
- 補足：LanguageService を直接呼ぶ API ではマッピングされず、tsserver の層で変換される。

### 位置情報の取得

クラス名ごとに「元ファイルの行・列」を求める `collectClassPositions(root: postcss.Root, ...): Map<string, Position>` を新しく作る。既存の `extractClassNameKeys` は変更しないため、型の内容には影響しない。

- `.css`：postcss の AST の各 rule の `source.start` から、セレクタ内のクラス名の位置を求める。
- `.scss` / `.sass`
  - `compileStringAsync` に `sourceMap: true` を渡す。
  - コンパイル後の CSS を postcss で parse し、各 rule の位置を `@jridgewell/trace-mapping` で元の位置に戻す。この依存を新しく追加する。
  - マッピング先がこのファイル（`url` に指定したファイル）でないものは捨てる。
  - `additionalData` を先頭に足した分の行のずれは、`getData` が返す最終データの中で `SPLIT_STR` がある行を基準にして差し引く。`additionalData` が関数の場合にも対応するため、`additionalData` の文字列の行数からは計算しない。
- クラス名には `localsConvention` に応じた変換（`getParseCase`）を同じように適用する。
- 同じクラス名が複数回出てくる場合は、最初に出てきた位置を使う。
- 元をたどれないクラス（他ファイルの mixin や `@extend` 由来など）は map に含めない。一部のクラスだけの map でよい。

### map の生成

- 整形後の型ファイルの文字列から、各クラス名の次の位置を探してマッピングする。整形で `readonly 'key'` のクォートが外れることがあるため、クォートの有無の両方を許容する。
  - `readonly <key>:`
  - `export const <key>:`（`useNamedExport` のとき）
- `sources` には、型ファイルのディレクトリから見た元ファイルの相対パスを入れる。`outputDir` を指定していても正しく解決させるため。
- 型ファイルの末尾に `//# sourceMappingURL=<map のファイル名>` を追記する。
- グローバル型ファイルには map を作らない。

### 不採用にした案

- 元の scss を正規表現で探す方法：実装は単純だが、`&-foo` のような入れ子の書き方やコンパイル時に生成されるクラス名に対応できない。

## 4. テスト

- 共通基盤
  - 既存テストがすべて変更なしで通ること。
  - `generateDts` が書き込みをせず、期待する `GeneratedFile[]` を返すこと。
  - `writeGeneratedFiles` が、内容が同じ場合は書き込まないこと。
- CLI
  - 一時ディレクトリに vite.config とフィクスチャを置いた統合テストを書く。
  - generate、check（missing / outdated / orphan）、`--clean`、終了コード 0 / 1 / 2 を確認する。
- Declaration map
  - trace-mapping で map を読み、各クラス名が元ファイルの正しい行を指すことを確認する。
  - ケース：scss の入れ子（`&-foo`）、`additionalData`、`outputDir`、`localsConvention`、`.css`、`.sass`、prettier と biome の両方。

## 5. ドキュメント

README に次を追加する。

- CLI の使い方と、CI での `check` の例（GitHub Actions）
- 型ファイルを `.gitignore` に入れ、`generate` で作り直す運用の例
- `declarationMap` オプションの説明と、エディタでの動作
