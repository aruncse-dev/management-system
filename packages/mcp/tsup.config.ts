import { defineConfig } from 'tsup'

/**
 * Workspace packages must be bundled, not externalised: `@fintracker-vault/db`
 * resolves to TypeScript source, which node cannot load at runtime.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  noExternal: [
    '@fintracker-vault/db',
    '@fintracker-vault/utils',
    '@fintracker-vault/config',
    '@fintracker-vault/types',
  ],
})
