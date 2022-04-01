import { Options } from 'prettier'
import { ResolvedConfig } from 'vite'

export type FinalConfig = ResolvedConfig & { prettierOptions: Options }

export type AdditionalData =
  | string
  | ((source: string, filename: string) => string | Promise<string>)

export type PluginOption = {
  enabledMode?: ('development' | 'production')[]
  global?: { generate: boolean; outFile: string }
}

export type CSS = { localStyle: string; globalStyle?: string }
