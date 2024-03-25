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
