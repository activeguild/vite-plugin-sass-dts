import { UserConfig } from "vite";

export const getPreprocessorOptions = (config: UserConfig) => {
  let additionalData, includePaths, importer;

  if (
    !config.css ||
    !config.css.preprocessorOptions ||
    !config.css.preprocessorOptions.scss
  ) {
    return { additionalData, includePaths, importer };
  }

  return config.css.preprocessorOptions.scss;
};
