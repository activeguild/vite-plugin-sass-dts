import fs from 'fs'
import path from 'path'
import prettier, { Options } from 'prettier'
import { getRelativePath } from './util'

export const writeToFile = async (
  prettierOptions: Options,
  fileName: string,
  classNameKeys: Map<string, boolean>,
  globalOutFile?: string
) => {
  let exportTypes = '',
    exportClassNames = 'export type ClassNames = '
  const exportStyle = 'export default classNames;'
  for (const classNameKey of classNameKeys.keys()) {
    exportTypes = `${exportTypes}\n${formatExportType(classNameKey)}`
    exportClassNames =
      exportClassNames !== 'export type ClassNames = '
        ? `${exportClassNames} | '${classNameKey}'`
        : `${exportClassNames} '${classNameKey}'`
  }

  let outputFileString = ''
  if (globalOutFile) {
    const relativePath = getRelativePath(
      path.dirname(fileName),
      path.dirname(globalOutFile)
    )
    const exportTypeFileName = formatExportTypeFileName(globalOutFile)
    const globalClassNamesPrefix = classNameKeys.size === 0 ? '' : '| '
    outputFileString = `import globalClassNames, { ClassNames as GlobalClassNames } from '${relativePath}${exportTypeFileName}'\n`
    outputFileString = `${outputFileString}declare const classNames: typeof globalClassNames & {${exportTypes}\n};\n${exportStyle}\n${exportClassNames} ${globalClassNamesPrefix}GlobalClassNames`
  } else {
    outputFileString = `declare const classNames: {${exportTypes}\n};\n${exportStyle}\n${exportClassNames}`
  }

  const prettierdPutputFileString = prettier.format(
    outputFileString,
    prettierOptions
  )

  fs.writeFile(
    formatWriteFileName(fileName),
    `${prettierdPutputFileString}`,
    (err) => {
      if (err) {
        console.log(err)
        throw err
      }
    }
  )
}

export const formatExportType = (key: string) =>
  `  readonly '${key}': '${key}';`

export const formatWriteFileName = (file: string) =>
  `${file}${file.endsWith('d.ts') ? '' : '.d.ts'}`

export const formatExportTypeFileName = (file: string) =>
  path.basename(file.replace('.ts', ''))
