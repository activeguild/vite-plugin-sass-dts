import fs from "fs";
import { camelCase } from "./util";

export const writeToFile = (
  file: string,
  classNameKeys: Map<string, boolean>
) => {
  if (classNameKeys.size === 0) {
    return;
  }

  let exportConsts = "";
  let exportType = "";
  for (const classNameKey of classNameKeys.keys()) {
    exportConsts = `${exportConsts}${formatExportConst(classNameKey)}\n`;
    exportType = exportType
      ? `${exportType} | '${classNameKey}'`
      : `export type ClassNames = '${classNameKey}'`;
  }

  fs.writeFile(
    formatWriteFileName(file),
    `${exportConsts}\n${exportType}`,
    (err) => {
      if (err) throw err;
    }
  );
};

export const formatExportConst = (key: string) =>
  `export const ${camelCase(key)} = '${key}'`;

export const formatWriteFileName = (file: string) => `${file}.d.ts`;
