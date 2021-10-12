export const camelCase = (str: string) => {
  str = str.charAt(0).toLowerCase() + str.slice(1);
  return str.replace(/[-_](.)/g, (_, group1) => {
    return group1.toUpperCase();
  });
};
