import type { Options } from 'prettier'
import type { Alias, ResolvedConfig } from 'vite'
import type Sass from 'sass-embedded'

export type FinalConfig = ResolvedConfig & { prettierOptions: Options }

export type AdditionalData =
  | string
  | ((source: string, filename: string) => string | Promise<string>)

// Vite's sass preprocessor option types changed across major versions
// (the legacy api options were dropped from the types in vite 8), so the
// plugin keeps its own shape covering both the legacy and modern APIs.
export type SassPreprocessorOptions = Omit<
  Sass.StringOptions<'async'>,
  'importers' | 'url' | 'syntax'
> & {
  additionalData?: AdditionalData
  api?: 'legacy' | 'modern' | 'modern-compiler'
  importer?: Sass.LegacyAsyncImporter | Sass.LegacyAsyncImporter[]
  importers?: Sass.Importer<'async'> | Sass.Importer<'async'>[]
  includePaths?: string[]
  alias?: Alias[]
}

export type PluginOptions = {
  enabledMode?: ('development' | 'production')[]
  global?: { generate: boolean; outputFilePath: string }
  typeName?: ContentReplacer
  exportName?: ContentReplacer
  esmExport?: boolean
  outputDir?: string
  sourceDir?: string
  excludePath?: string | RegExp | Array<string | RegExp>
  prettierFilePath?: string
  useNamedExport?: boolean
  legacyFileFormat?: boolean
}

export type CSS = { localStyle: string; globalStyle?: string }

export type CSSJSObj = Record<
  string,
  string | Record<string, string> | Record<string, Record<string, string>>[]
>

export type GetParseCaseFunction = ((target: string) => string) | undefined

export type ContentReplacer = {
  replacement: string | ((fileName: string) => string)
}

export type CssUrlReplacer = (
  url: string,
  importer?: string
) => string | Promise<string>
