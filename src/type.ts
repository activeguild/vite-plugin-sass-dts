import type { Options } from 'prettier'
import type { ResolvedConfig } from 'vite'

export type FinalConfig = ResolvedConfig & { prettierOptions: Options }

export type AdditionalData =
  | string
  | ((source: string, filename: string) => string | Promise<string>)

export type PluginOptions = {
  enabledMode?: ('development' | 'production')[]
  global?: { generate: boolean; outputFilePath: string }
  typeName?: { replacement: string | ((fileName: string) => string) }
  esmExport?: boolean
  outputDir?: string
  sourceDir?: string
  excludePath?: string | RegExp | Array<string | RegExp>
  prettierFilePath?: string
  useNamedExport?: boolean
}

export type CSS = { localStyle: string; globalStyle?: string }

export type CSSJSObj = Record<
  string,
  string | Record<string, string> | Record<string, Record<string, string>>[]
>

export type GetParseCaseFunction = ((target: string) => string) | undefined

export type CssUrlReplacer = (
  url: string,
  importer?: string
) => string | Promise<string>
