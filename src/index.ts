import { Plugin } from "vite";
import { renderSync } from "sass";
import postcssJs from "postcss-js";
import postcss from "postcss";
import { extractClassNameKeys } from "./extract";
import { writeToFile } from "./write";

export default function Plugin(): Plugin {
  return {
    name: "vite-plugin-sass-dts",
    handleHotUpdate(context) {
      if (!context.file.endsWith("scss")) return;

      try {
        const result = renderSync({ file: context.file });
        const classNameKeys = extractClassNameKeys(
          postcssJs.objectify(postcss.parse(result.css.toString()))
        );
        writeToFile(context.file, classNameKeys);
      } catch (e) {
        console.error("e :>> ", e);
      }
      return;
    },
  };
}
