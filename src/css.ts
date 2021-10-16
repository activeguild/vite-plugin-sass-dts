import { getPreprocessorOptions } from "./options";
import { renderSync } from "sass";
import { AdditionalData } from "./type";
import { HmrContext } from "vite";

export const parseCss = async (file: Buffer, context: HmrContext) => {
  const { additionalData, includePaths, importer } =
    getPreprocessorOptions(context);

  const result = renderSync({
    data: await getData(file.toString(),context.file, additionalData),
    includePaths,
    importer,
  });

  return result.css.toString();
};

const getData = (
  data: string,
  filename: string,
  additionalData?: AdditionalData
): string | Promise<string> => {
  if (!additionalData) return data;
  if (typeof additionalData === "function") {
    return additionalData(data, filename);
  }
  return `${additionalData} ${data}`;
};
