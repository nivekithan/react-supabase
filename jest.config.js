/* eslint-disable no-undef */

/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@src/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/src/__tests__/utils",
    "<rootDir>/src/__tests__/coverage",
  ],
  setupFilesAfterEnv: ["./src/__tests__/utils/setup.ts"],
  coverageProvider: "v8",
  coverageDirectory: "<rootDir>/src/__tests__/coverage",
  collectCoverage: true,
  collectCoverageFrom: ["<rootDir>/src/react-supabase/*"],
};
