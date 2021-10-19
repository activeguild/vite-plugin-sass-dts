import { getPreprocessorOptions } from "./options";
import { renderSync } from "sass";
import { AdditionalData } from "./type";
import { UserConfig } from "vite";

export const parseCss = async (
  file: Buffer,
  fileName: string,
  config: UserConfig
) => {
  const { additionalData, includePaths, importer } =
    getPreprocessorOptions(config);

  const result = renderSync({
    data: await getData(file.toString(), fileName, additionalData),
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
