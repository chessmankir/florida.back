const { defineConfig, globalIgnores } = require('eslint/config');

const tsParser = require('@typescript-eslint/parser');
const typescriptEslintEslintPlugin = require('@typescript-eslint/eslint-plugin');
const prettier = require('eslint-plugin-prettier');
const globals = require('globals');
const js = require('@eslint/js');

const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

module.exports = defineConfig([
    {
        languageOptions: {
            parser: tsParser,
            sourceType: 'module',

            parserOptions: {
                project: 'tsconfig.json',
                tsconfigRootDir: __dirname,
            },

            globals: {
                ...globals.node,
                ...globals.jest,
            },
        },

        plugins: {
            '@typescript-eslint': typescriptEslintEslintPlugin,
            prettier,
        },

        extends: compat.extends('plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'),

        rules: {
            '@typescript-eslint/interface-name-prefix': 'off',
            '@typescript-eslint/explicit-function-return-type': 'error',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',

            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                },
            ],

            '@typescript-eslint/no-empty-function': 'off',

            '@typescript-eslint/explicit-member-accessibility': [
                'error',
                {
                    accessibility: 'explicit',

                    overrides: {
                        constructors: 'no-public',
                    },
                },
            ],

            'max-len': [
                'error',
                {
                    code: 140,
                    ignoreStrings: true,
                    ignoreUrls: true,
                    ignoreTemplateLiterals: true,
                    ignoreRegExpLiterals: true,
                },
            ],

            'prettier/prettier': [
                'error',
                {
                    endOfLine: 'auto',
                },
                {
                    usePrettierrc: true,
                },
            ],

            'no-useless-escape': 'off',

            indent: 'off',

            quotes: [
                'error',
                'single',
                {
                    allowTemplateLiterals: true,
                    avoidEscape: true,
                },
            ],

            semi: ['error', 'always'],

            'operator-linebreak': [
                'error',
                'after',
                {
                    overrides: {
                        '?': 'before',
                        ':': 'before',
                    },
                },
            ],

            'dot-location': ['error', 'property'],
            'lines-between-class-members': ['error', 'always'],

            'no-multiple-empty-lines': [
                'error',
                {
                    max: 2,
                    maxEOF: 0,
                },
            ],

            curly: ['error', 'all'],

            'no-restricted-syntax': [
                'error',
                {
                    selector: 'SwitchCase > *.consequent[type!="BlockStatement"]',
                    message: 'Switch cases without blocks are disallowed.',
                },
            ],

            'no-param-reassign': [
                'error',
                {
                    props: true,
                    ignorePropertyModificationsFor: ['acc'],
                },
            ],

            '@typescript-eslint/no-empty-object-type': 'off',
        },
    },
    globalIgnores(['**/.eslintrc.js', '**/.prettierrc', '**/.eslint.config.js', '**/eslint.config.js']),
    globalIgnores(['**/node_modules', '**/.git', '**/.vscode', '**/.*.env', '**/*.env', '**/*.md']),
]);
