export const extractClassNameKeys = (
  obj: Record<string, any>
): Map<string, boolean> => {
  return Object.entries(obj).reduce<Map<string, boolean>>(
    (curr, [key, value]) => {
      const splittedKeys = key.replace(" ", "").split(/(?=\.)/g);
      for (const splittedKey of splittedKeys) {
        if (splittedKey.startsWith(".")) {
          curr.set(splittedKey.replace(".", ""), true);
        }
      }

      if (typeof value === "object" && Object.keys(value).length > 0) {
        const map = extractClassNameKeys(value);
        for (const key of map.keys()) {
          if (key.startsWith(".")) {
            curr.set(key, true);
          }
        }
      }

      return curr;
    },
    new Map()
  );
};
