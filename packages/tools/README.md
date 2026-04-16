# Development Tools

Shared tools and configurations for the monorepo.

## Directories

### scripts/
Build and utility scripts.

- `version-bump.js` - Version bumping utility
- `changelog-gen.js` - Changelog generation
- `validate-deps.js` - Dependency validation

### configs/
Shared configuration packages.

- **eslint-config/** - Shared ESLint configuration
- **prettier-config/** - Shared Prettier configuration
- **tsconfig/** - Shared TypeScript configuration
  - `base.json` - Base configuration
  - `react.json` - React-specific configuration
  - `node.json` - Node.js-specific configuration

## Usage

Configurations are referenced in respective package/app `package.json` files and configuration files.

Example:
```json
// package.json
{
  "eslintConfig": {
    "extends": ["@fintracker-vault/eslint-config"]
  }
}
```

```json
// tsconfig.json
{
  "extends": "@fintracker-vault/tsconfig/base.json"
}
```
