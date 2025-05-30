import { writeFile } from 'node:fs'
import { dirname, basename, isAbsolute } from 'node:path'
import prettier from 'prettier'
const { format } = prettier

import { type Options } from 'prettier'
import { ContentReplacer, PluginOptions } from 'type'
import { getRelativePath } from './util'
import path from 'path'
import { mkdir } from 'node:fs/promises'

export const writeToFile = async (
  prettierOptions: Options,
  fileName: string,
  classNameKeys: Map<string, boolean>,
  options?: PluginOptions,
  sourceMap?: string | null
) => {
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
    outputFileString = `declare const ${exportName}: typeof globalClassNames & {${exportTypes}\n};\n${exportStyle}`
    if (options?.useNamedExport) {
      outputFileString = `${outputFileString}\n${namedExports}\n\n`
    }
  } else {
    outputFileString = `declare const ${exportName}: {${exportTypes}\n};\n${exportStyle}`
    if (options?.useNamedExport) {
      outputFileString = `${outputFileString}\n\n${namedExports}`
    }
  }

  // Add source map comment if present
  if (sourceMap) {
    outputFileString = `${outputFileString}\n${sourceMap}`
  }

  const prettierdOutputFileString = await format(
    outputFileString,
    prettierOptions
  )

  const writePath = formatWriteFilePath(fileName, options)

  await ensureDirectoryExists(writePath)

  writeFile(writePath, `${prettierdOutputFileString}`, (err) => {
    if (err) {
      console.log(err)
      throw err
    }
  })
}

export const getReplacerResult = (
  fileName: string,
  replacer?: ContentReplacer
) => {
  if (replacer && replacer.replacement) {
    if (typeof replacer.replacement === 'function') {
      return replacer.replacement(fileName)
    } else {
      return replacer.replacement
    }
  }

  return undefined
}

export const formatExportType = (key: string, type = `'${key}'`) =>
  `  readonly '${key}': ${type};`

export const formatWriteFilePath = (file: string, options?: PluginOptions) => {
  let path = file
  const src = options?.sourceDir
  const dist = options?.outputDir

  if (src && !isAbsolute(src)) {
    throw new Error('vite-plugin-sass-dts sourceDir must be an absolute path')
  }
  if (dist && !isAbsolute(dist)) {
    throw new Error('vite-plugin-sass-dts outputDir must be an absolute path')
  }

  if (src && dist) {
    path = path.replace(src, dist)
  }

  return formatWriteFileName(path)
}

export const formatWriteFileName = (file: string) =>
  `${file}${file.endsWith('d.ts') ? '' : '.d.ts'}`

export const formatExportTypeFileName = (file: string) =>
  basename(file.replace('.ts', ''))

export const ensureDirectoryExists = async (file: string) => {
  await mkdir(dirname(file), { recursive: true })
}
