// =============================================================================
// Module-boundary enforcement — the "split lever" guarantee.
//
// These rules are NOT cosmetic. They are the only thing standing between
// "modular monolith we can split tomorrow" and "ball of mud monolith we can
// never untangle". CI must fail on any violation.
//
// The contract:
//   - Inside a module, anything goes.
//   - Across modules, you may ONLY import from another module's
//     `public-api/` barrel. Reaching into `internal/`, `schemas/`, or `dto/`
//     of another module is forbidden.
//   - Bootstrap is shared infrastructure (auth guard, DB, event bus, etc.) —
//     any module may import from it.
//   - Modules may freely import from `packages/shared` and `packages/types`
//     (the shared kernel).
//
// When you split a module out to a microservice tomorrow:
//   - The public-api/ folder becomes the HTTP/gRPC contract.
//   - Cross-module imports continue to compile because they were always
//     interface-only — the implementation just changes from in-process to
//     remote-call.
// =============================================================================
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js', 'dist/**'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

    // === The boundary rule ===
    // Forbid reaching into another module's internals. Only public-api is
    // allowed across module boundaries.
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: [
            '../*/internal/**',
            '../**/modules/*/internal/**',
            '@modules/*/internal/**',
          ],
          message:
            'Cross-module imports must go through public-api/ — reaching into another module\'s internal/ breaks the split-lever contract. ' +
            'If you need a method that isn\'t exposed yet, add it to that module\'s AuthPublicApi (or equivalent) interface.',
        },
        {
          group: [
            '../*/schemas/**',
            '../**/modules/*/schemas/**',
            '@modules/*/schemas/**',
          ],
          message:
            'Cross-module schema imports are forbidden — each module owns its own data and exposes it via public-api/, not raw Mongoose models. ' +
            'This is the rule that makes per-module DB extraction trivial later.',
        },
      ],
    }],
  },
};
