import { HmrContext } from "vite";

export const getPreprocessorOptions = (context: HmrContext) => {
  let additionalData, includePaths, importer;

  if (
    !context.server.config.css ||
    !context.server.config.css.preprocessorOptions ||
    !context.server.config.css.preprocessorOptions.scss
  ) {
    return { additionalData, includePaths, importer };
  }

  return context.server.config.css.preprocessorOptions.scss;
};
