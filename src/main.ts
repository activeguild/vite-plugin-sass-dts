import { UserConfig } from "vite";
import fs from "fs";
import { parseCss } from "./css";
import postcssJs from "postcss-js";
import { extractClassNameKeys } from "./extract";
import postcss from "postcss";
import { writeToFile } from "./write";

export const main = (fileName: string, config: UserConfig) => {
  try {
    fs.readFile(fileName, async (err, file) => {
      if (err) {
        console.error(err);
      } else {
        const css = fileName.endsWith(".css")
          ? file.toString()
          : await parseCss(file, fileName, config);
        const classNameKeys = extractClassNameKeys(
          postcssJs.objectify(postcss.parse(css))
        );
        writeToFile(fileName, classNameKeys);
      }
    });
  } catch (e) {
    console.error("e :>> ", e);
  }
};
