module.exports = {
  root: true,

  extends: ['@metamask/eslint-config', '@metamask/eslint-config-nodejs'],

  rules: {
    'node/no-process-exit': 'off',
    'node/no-sync': 'off',
  },

  overrides: [
    {
      files: ['**/*.test.js'],
      extends: ['@metamask/eslint-config-jest'],
    },
  ],

  ignorePatterns: ['!.eslintrc.js'],
};
