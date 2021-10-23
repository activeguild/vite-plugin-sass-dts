import fs from "fs";
import path from "path";
import { getRelativePath } from "./util";

export const writeToFile = (
  fileName: string,
  classNameKeys: Map<string, boolean>,
  globalOutFile?: string
) => {
  let exportTypes = "";
  let exportStyle = "export = classNames;";
  for (const classNameKey of classNameKeys.keys()) {
    exportTypes = `${exportTypes}\n${formatExportType(classNameKey)}`;
  }

  let outputFileString = "";
  if (globalOutFile) {
    const relativePath = getRelativePath(
      path.dirname(fileName),
      path.dirname(globalOutFile)
    );
    const exportTypeFileName = formatExportTypeFileName(globalOutFile);
    outputFileString = `import globalClassNames from '${relativePath}${exportTypeFileName}'\n`;
    outputFileString = `${outputFileString}declare const classNames: typeof globalClassNames & {${exportTypes}\n};\n${exportStyle}`;
  } else {
    outputFileString = `declare const classNames: {${exportTypes}\n};\n${exportStyle}`;
  }

  fs.writeFile(formatWriteFileName(fileName), `${outputFileString}`, (err) => {
    if (err) {
      console.log(err);
      throw err;
    }
  });
};

export const formatExportType = (key: string) =>
  `  readonly '${key}': '${key}';`;

export const formatWriteFileName = (file: string) =>
  `${file}${file.endsWith("d.ts") ? "" : ".d.ts"}`;

export const formatExportTypeFileName = (file: string) =>
  path.basename(file.replace(".ts", ""));
