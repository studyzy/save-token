import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // CLI 输出模块：console.log/error 是核心输出方式，允许使用。
    files: [
      'src/utils/output.ts',
      'src/commands/trace.ts',
      'src/commands/optimize.ts',
      'src/commands/analyze.ts',
      'src/commands/report.ts',
      'src/commands/rollback.ts',
      'src/utils/error-handler.ts',
    ],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'bin/**', 'coverage/**', '*.config.*'],
  },
)
