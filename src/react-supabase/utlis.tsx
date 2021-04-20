const stableStringifyReplacer = (_key: string, value: any): unknown => {
  if (typeof value === "function") {
    throw new Error("Cannot stringify non JSON value");
  }

  if (isObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = value[key];
        return result;
      }, {} as any);
  }

  return value;
};

export const stableStringify = (value: any): string => {
  return JSON.stringify(value, stableStringifyReplacer);
};

const isObject = (a: unknown): boolean => {
  return !!a && typeof a === "object" && !Array.isArray(a);
};
