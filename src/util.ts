export const camelCase = (str: string) => {
  str = str.charAt(0).toLowerCase() + str.slice(1);
  return str.replace(/[-_](.)/g, (_, group1) => {
    return group1.toUpperCase();
  });
};

// export const cssLangs = `\\.(css|less|sass|scss|styl|stylus|pcss|postcss)($|\\?)`;
export const cssLangs = `\\.(css|sass|scss)($|\\?)`;
export const cssLangReg = new RegExp(cssLangs);

export const isCSSRequest = (request: string): boolean =>
  cssLangReg.test(request);
