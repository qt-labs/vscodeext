/* eslint-env node */
module.exports = {
  extends: ['./common/.eslintrc.cjs'],
  plugins: ['@typescript-eslint'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname
  }
};
