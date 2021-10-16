export type AdditionalData =
  | string
  | ((source: string, filename: string) => string | Promise<string>)