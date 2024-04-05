/* eslint-env node */
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
  ],
  "rules": {
    "@typescript-eslint/no-shadow": "error",
    "@typescript-eslint/prefer-readonly": "error",
    "@typescript-eslint/return-await": "error",
    "@typescript-eslint/no-loop-func": "error",
    "@typescript-eslint/no-unnecessary-qualifier": "error",
    "@typescript-eslint/prefer-find": "error",
    "@typescript-eslint/no-require-imports": "error",
    "@typescript-eslint/restrict-plus-operands": "error",
    "@typescript-eslint/switch-exhaustiveness-check": "error",
    "@typescript-eslint/no-useless-empty-export": "error"
  },
  plugins: ['@typescript-eslint'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  root: true,
  ignorePatterns: ['out', 'src/test'],
};
