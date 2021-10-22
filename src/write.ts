import fs from "fs";
import path from "path";
import { replaceSeparation, getRelativePath } from "./util";

export const writeToFile = (
  fileName: string,
  classNameKeys: Map<string, boolean>,
  globalStyle?: boolean,
  globalOutFile?: string
) => {
  if (classNameKeys.size === 0) {
    return;
  }

  let exportConsts = "";
  let exportType = "";
  const exportTypePrefix = globalStyle
    ? "export type GlobalClassNames = "
    : "export type ClassNames = ";
  for (const classNameKey of classNameKeys.keys()) {
    exportConsts = `${exportConsts}${formatExportConst(classNameKey)}\n`;
    exportType = exportType
      ? `${exportType} | '${classNameKey}'`
      : `${exportTypePrefix}'${classNameKey}'`;
  }

  let outputFileString = "";
  if (globalOutFile) {
    const relativePath = getRelativePath(
      path.dirname(fileName),
      path.dirname(globalOutFile)
    );
    const exportTypeFileName = formatExportTypeFileName(globalOutFile);
    outputFileString = `export * from '${relativePath}${exportTypeFileName}'\n`;
    outputFileString = `${outputFileString}import { GlobalClassNames } from '${relativePath}${exportTypeFileName}'\n\n`;
    outputFileString = `${outputFileString}${exportConsts}\n${exportType} | GlobalClassNames`;
  } else {
    outputFileString = `${exportConsts}\n${exportType}`;
  }

  fs.writeFile(formatWriteFileName(fileName), `${outputFileString}`, (err) => {
    if (err) throw err;
  });
};

export const formatExportConst = (key: string) =>
  `export const ${replaceSeparation(key)} = '${key}'`;

export const formatWriteFileName = (file: string) =>
  `${file}${file.endsWith("d.ts") ? "" : ".d.ts"}`;

export const formatExportTypeFileName = (file: string) =>
  path.basename(file.replace(".ts", ""));
