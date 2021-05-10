import type { DbContext } from "./db";
import type { DeDbContext } from "./deDb";

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

const stableStringify = (value: any): string => {
  return JSON.stringify(value, stableStringifyReplacer);
};

const isObject = (a: unknown): boolean => {
  return !!a && typeof a === "object" && !Array.isArray(a);
};

type Hash =
  | {
      isHashFunProvided: false;
      defaultHashFun: (value: any) => string;
      providedHashFun: undefined;
    }
  | {
      isHashFunProvided: true;
      defaultHashFun: (value: any) => string;
      providedHashFun: (value: any) => string;
    };

export let hash: Hash = {
  defaultHashFun: stableStringify,
  isHashFunProvided: false,
  providedHashFun: undefined,
};

type hashFunction = (value: any) => string;

export const setHashFunction = (
  hashFunction: (provided: hashFunction) => (value: any) => string
) => {
  const providedHashFun = hashFunction(stableStringify);

  hash = {
    isHashFunProvided: true,
    defaultHashFun: stableStringify,
    providedHashFun,
  };
};

export const getHash = <data, props>(
  db: DbContext<data, props> | DeDbContext<data, props>,
  value: props
) => {
  const hashString = hash.isHashFunProvided
    ? hash.providedHashFun(value)
    : hash.defaultHashFun(value);

  return `ID_${db.id}_ID_${hashString}`;
};
