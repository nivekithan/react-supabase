import type { DbContext } from "./db";
import { MutateContext } from "./mutate";

const stableStringifyReplacer = (_key: string, value: any): unknown => {
  if (typeof value === "function") {
    throw new Error(
      "Cannot serialize non JSON value, use setHashFunction to override default function"
    );
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

export const getHash = <Data, HookProps, SetProps = unknown>(
  db: DbContext<Data, HookProps> | MutateContext<Data, HookProps, SetProps>,
  value: HookProps
) => {
  const hashString = hash.isHashFunProvided
    ? hash.providedHashFun(value)
    : hash.defaultHashFun(value);

  return `ID_${db.id}_ID_${hashString}`;
};
