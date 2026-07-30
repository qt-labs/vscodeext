// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Shared ESLint configuration for the Qt VS Code extensions.
 *
 * `@eslint/js` and `typescript-eslint` are resolved from the monorepo root
 * node_modules because this module lives in `common/`.
 *
 * @param {object} options
 * @param {string} options.tsconfigRootDir directory containing the
 *                                         tsconfig.json used for
 *                                         type-aware linting
 */
export function createConfig({ tsconfigRootDir }) {
  return tseslint.config(
    {
      ignores: ['**/out/**', '**/test/**', '**/webview-ui/**']
    },
    {
      files: ['**/*.ts', '**/*.mts', '**/*.cts'],
      extends: [
        js.configs.recommended,
        tseslint.configs.strictTypeChecked,
        tseslint.configs.stylisticTypeChecked
      ],
      languageOptions: {
        parserOptions: {
          project: 'tsconfig.json',
          tsconfigRootDir
        }
      },
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
        '@typescript-eslint/no-unused-vars': [
          'error',
          { caughtErrors: 'none' }
        ],
        '@typescript-eslint/no-misused-promises': [
          'error',
          // Async overrides of void-returning base class methods are the
          // established pattern for vscode DebugSession request handlers.
          { checksVoidReturn: { inheritedMethods: false } }
        ],
        '@typescript-eslint/prefer-nullish-coalescing': [
          'error',
          // `x ? x : y` differs from `x ?? y` for falsy non-nullish values,
          // so converting ternaries is not behavior preserving.
          { ignoreTernaryTests: true }
        ],
        '@typescript-eslint/switch-exhaustiveness-check': [
          'error',
          { considerDefaultExhaustiveForUnions: true }
        ],
        // Type parameters that appear only in the return type are used as
        // intentional cast-style APIs (e.g. CoreAPI.getValue<T>).
        '@typescript-eslint/no-unnecessary-type-parameters': 'off',
        curly: 'error'
      }
    }
  );
}
