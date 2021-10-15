import { Plugin } from "vite";
import { renderSync } from "sass";
import postcssJs from "postcss-js";
import postcss from "postcss";
import { extractClassNameKeys } from "./extract";
import { writeToFile } from "./write";
import fs from "fs";
import { getPreprocessorOptions } from "./options";

export default function Plugin(): Plugin {
  return {
    name: "vite-plugin-sass-dts",
    handleHotUpdate(context) {
      if (!context.file.endsWith("scss") && !context.file.endsWith("sass"))
        return;

      try {
        fs.readFile(context.file, (err, file) => {
          if (err) {
            console.error(err);
          } else {
            const { additionalData, includePaths, importer } =
              getPreprocessorOptions(context);

            const result = renderSync({
              data: `${additionalData ? additionalData : ""}${file.toString()}`,
              includePaths,
              importer,
            });
            const classNameKeys = extractClassNameKeys(
              postcssJs.objectify(postcss.parse(result.css.toString()))
            );
            writeToFile(context.file, classNameKeys);
          }
        });
      } catch (e) {
        console.error("e :>> ", e);
      }
      return;
    },
  };
}
