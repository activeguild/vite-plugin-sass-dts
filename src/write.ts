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

  return formatWriteFileName(path, options?.legacyFileFormat)
}

export const formatWriteFileName = (file: string, legacyFormat = false) => {
  if (file.endsWith('d.ts')) {
    return file
  }

  if (legacyFormat) {
    // Legacy format: sample.module.scss.d.ts
    return `${file}.d.ts`
  }

  // TypeScript 5 format: sample.module.d.scss.ts
  // Extract the file extension (e.g., .scss, .sass, .css)
  const extensionMatch = file.match(/\.(scss|sass|css)$/)
  if (extensionMatch) {
    const extension = extensionMatch[1]
    const basePath = file.slice(0, -extension.length - 1) // Remove .scss/.sass/.css
    return `${basePath}.d.${extension}.ts`
  }

  // Fallback for unknown extensions
  return `${file}.d.ts`
}

export const formatExportTypeFileName = (file: string) =>
  basename(file.replace('.ts', ''))

export const ensureDirectoryExists = async (file: string) => {
  await mkdir(dirname(file), { recursive: true })
}
