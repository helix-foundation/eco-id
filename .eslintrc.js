module.exports = {
  env: {
    browser: false,
    es2021: true,
    mocha: true,
    node: true,
  },
  plugins: ["@typescript-eslint", "mocha", "chai-friendly"],
  extends: [
    "standard",
    "plugin:prettier/recommended",
    "plugin:node/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    camelcase: 0,
    "no-unused-expressions": 0,
    "no-plusplus": 0,
    "prefer-destructuring": 0,
    "mocha/no-exclusive-tests": "error",
    "chai-friendly/no-unused-expressions": 2,
    "@typescript-eslint/no-unused-vars": ["error"],
    "no-multiple-empty-lines": [
      "error",
      {
        max: 1,
        maxEOF: 0,
        maxBOF: 0,
      },
    ],
    "node/no-unsupported-features/es-syntax": [
      "error",
      { ignores: ["modules"] },
    ],
    "node/no-missing-import": [
      "error",
      {
        allowModules: [],
        tryExtensions: [".js", ".json", ".node", ".ts", ".d.ts"],
      },
    ],
  },
}
