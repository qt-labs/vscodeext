/* eslint-env node */
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked'
  ],
  rules: {
    '@typescript-eslint/promise-function-async': 'error',
    '@typescript-eslint/no-useless-empty-export': 'error',
    'default-param-last': 'off',
    '@typescript-eslint/default-param-last': 'error',
    'class-methods-use-this': 'off',
    '@typescript-eslint/class-methods-use-this': 'error',
    '@typescript-eslint/no-shadow': 'error',
    '@typescript-eslint/prefer-readonly': 'error',
    '@typescript-eslint/return-await': 'error',
    '@typescript-eslint/no-loop-func': 'error',
    '@typescript-eslint/no-unnecessary-qualifier': 'error',
    '@typescript-eslint/prefer-find': 'error',
    '@typescript-eslint/no-require-imports': 'error',
    '@typescript-eslint/restrict-plus-operands': 'error',
    '@typescript-eslint/switch-exhaustiveness-check': 'error',
    curly: 'error'
  },
  root: true,
  ignorePatterns: ['out', 'src/test', 'webview-ui/']
};
