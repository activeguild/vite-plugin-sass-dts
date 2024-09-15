import type { FinalConfig, GetParseCaseFunction } from './type'
import { toCamelCase, toDashCase } from './util'

export const getParseCase = (config: FinalConfig): GetParseCaseFunction => {
  if (
    !config.css ||
    !config.css.modules ||
    !config.css.modules.localsConvention
  ) {
    return
  }

  const { localsConvention } = config.css.modules

  if (
    localsConvention === 'camelCase' ||
    localsConvention === 'camelCaseOnly'
  ) {
    return toCamelCase
  } else if (
    localsConvention === 'dashes' ||
    localsConvention === 'dashesOnly'
  ) {
    return toDashCase
  }
  return
}

export const getPreprocessorOptions = (config: FinalConfig) => {
  let additionalData, includePaths, importer

  if (
    !config.css ||
    !config.css.preprocessorOptions ||
    !config.css.preprocessorOptions.scss
  ) {
    return {
      additionalData,
      includePaths,
      importer,
      alias: config.resolve.alias,
    }
  }

  return config.css.preprocessorOptions.scss
}
