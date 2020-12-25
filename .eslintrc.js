module.exports = {
  root: true,
  env: {
    // Environment global variables
    node: true,
  },
  extends: [
    'plugin:vue/vue3-essential',
    'eslint:recommended',
    '@vue/typescript/recommended',
    '@vue/prettier',
    '@vue/prettier/@typescript-eslint',
  ],
  parserOptions: {
    ecmaVersion: 2020,
  },
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    // Don't care about To Do's but fail on Fix Me's; this only affects sources as handled
    // by ESLint (so: not the HTML parts in .vue files, nor stylesheets, nor other files)
    'no-warning-comments': [
      'error',
      {
        terms: ['fixme'],
        location: 'anywhere',
      },
    ],
  },
  overrides: [
    {
      files: ['**/__tests__/*.{j,t}s?(x)', '**/tests/unit/**/*.spec.{j,t}s?(x)'],
      env: {
        jest: true,
      },
    },
  ],
};
