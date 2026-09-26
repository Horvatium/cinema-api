const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

module.exports = [
    { ignores: ['node_modules/', 'uploads/', 'coverage/'] },
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'commonjs',
            globals: { ...globals.node, ...globals.jest },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^next$' }],
            eqeqeq: 'error',
            'prefer-const': 'error',
        },
    },
    prettier,
];
