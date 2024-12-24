import { writeFile } from 'node:fs'
import { dirname, basename, isAbsolute } from 'node:path'
import prettier from 'prettier'
const { format } = prettier

import { type Options } from 'prettier'
import { PluginOptions } from 'type'
import { getRelativePath } from './util'
import path from 'path'
import { mkdir } from 'node:fs/promises'

export const writeToFile = async (
  prettierOptions: Options,
  fileName: string,
  classNameKeys: Map<string, boolean>,
  options?: PluginOptions
) => {
  const typeName = getTypeName(path.basename(fileName), options)
  let exportTypes = ''
  let namedExports = ''
  const exportStyle = options?.esmExport
    ? 'export default classNames;'
    : 'export = classNames;'
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
    outputFileString = `declare const classNames: typeof globalClassNames & {${exportTypes}\n};\n${exportStyle}`
    if (options?.useNamedExport) {
      outputFileString = `${outputFileString}\n${namedExports}\n\n`
    }
  } else {
    outputFileString = `declare const classNames: {${exportTypes}\n};\n${exportStyle}`
    if (options?.useNamedExport) {
      outputFileString = `${outputFileString}\n\n${namedExports}`
    }
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

export const getTypeName = (fileName: string, options?: PluginOptions) => {
  if (options && options.typeName && options.typeName.replacement) {
    if (typeof options.typeName.replacement === 'function') {
      return options.typeName.replacement(fileName)
    } else {
      return options.typeName.replacement
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
