import path from "path";

export const replaceSeparation = (str: string) => {
  return str.replace(/[-](.)/g, (_, group1) => {
    return group1;
  });
};

// export const cssLangs = `\\.(css|less|sass|scss|styl|stylus|pcss|postcss)($|\\?)`;
export const cssLangs = `\\.(css|sass|scss)($|\\?)`;
export const cssLangReg = new RegExp(cssLangs);

export const isCSSRequest = (request: string): boolean =>
  cssLangReg.test(request);

export const getRelativePath = (
  from: string | undefined,
  to: string | undefined
) => path.relative(path.dirname(from || ""), path.dirname(to || "")) || "./";
