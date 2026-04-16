# CI/CD Setup Guide

## Overview

Automated testing, linting, and deployment using GitHub Actions and Turbo.

---

## 1. Turbo Configuration

### File: `turbo.json` (at root)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "version": "1",
  "extends": ["//"],
  "globalDependencies": [
    "package.json",
    ".env.example",
    "pnpm-lock.yaml"
  ],
  "pipeline": {
    "type-check": {
      "cache": false,
      "dependsOn": ["^build"]
    },
    "lint": {
      "cache": false,
      "outputs": [".eslintcache"]
    },
    "build": {
      "cache": true,
      "dependsOn": ["^build"],
      "outputs": [
        ".next/**",
        "!.next/cache",
        "dist/**"
      ]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "cache": false,
      "outputs": ["coverage/**"]
    }
  },
  "ui": "tui"
}
```

**Key Settings:**
- `cache: true` - Cache build outputs for faster rebuilds
- `dependsOn: ["^build"]` - Build dependencies first
- `outputs` - What to cache after task completes

---

## 2. GitHub Actions Workflows

### Workflow 1: CI - Lint, Test, Type Check

**File:** `.github/workflows/ci.yml`

```yaml
name: CI - Lint, Test, Type Check

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  lint-test:
    name: Lint, Test & Type Check
    runs-on: ubuntu-latest
    timeout-minutes: 15
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Type Check
        run: pnpm run type-check
      
      - name: Lint
        run: pnpm run lint
      
      - name: Run tests
        run: pnpm run test
      
      - name: Build shared packages
        run: pnpm run build --scope="@fintracker-vault/ui" --scope="@fintracker-vault/types" --scope="@fintracker-vault/config" --scope="@fintracker-vault/utils"
      
      - name: Upload coverage
        if: matrix.node-version == '20.x'
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          fail_ci_if_error: false
```

---

### Workflow 2: Build & Deploy Fintracker

**File:** `.github/workflows/deploy-fintracker.yml`

```yaml
name: Deploy Fintracker to Vercel

on:
  push:
    branches: [main]
    paths:
      - 'packages/apps/fintracker/**'
      - 'packages/shared/**'
      - 'pnpm-lock.yaml'
  workflow_dispatch:

jobs:
  build-and-deploy:
    name: Build & Deploy Fintracker
    runs-on: ubuntu-latest
    timeout-minutes: 30
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Type Check
        run: pnpm type-check
      
      - name: Lint Fintracker
        run: pnpm lint --scope=fintracker
      
      - name: Build Fintracker
        run: pnpm build:fintracker
      
      - name: Deploy to Vercel
        uses: vercel/action@v5
        with:
          token: ${{ secrets.VERCEL_TOKEN }}
          team-id: ${{ secrets.VERCEL_TEAM_ID }}
          project-id: ${{ secrets.VERCEL_PROJECT_ID_FINTRACKER }}
          scope: ${{ secrets.VERCEL_ORG_ID }}
        env:
          VERCEL_PROJECT_PRODUCTION_DEPLOYMENT: 'true'
      
      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '✅ Fintracker built and deployed successfully! 🚀'
            })
      
      - name: Slack Notification
        if: failure()
        uses: slackapi/slack-github-action@v1.24.0
        with:
          payload: |
            {
              "text": "❌ Fintracker deployment failed",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Fintracker Deployment Failed*\nCommit: ${{ github.sha }}\nAuthor: ${{ github.actor }}"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

### Workflow 3: Build & Deploy Vault

**File:** `.github/workflows/deploy-vault.yml`

```yaml
name: Deploy Vault to Vercel

on:
  push:
    branches: [main]
    paths:
      - 'packages/apps/vault/**'
      - 'packages/shared/**'
      - 'pnpm-lock.yaml'
  workflow_dispatch:

jobs:
  build-and-deploy:
    name: Build & Deploy Vault
    runs-on: ubuntu-latest
    timeout-minutes: 30
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Type Check
        run: pnpm type-check
      
      - name: Lint Vault
        run: pnpm lint --scope=vault
      
      - name: Build Vault
        run: pnpm build:vault
      
      - name: Deploy to Vercel
        uses: vercel/action@v5
        with:
          token: ${{ secrets.VERCEL_TOKEN }}
          team-id: ${{ secrets.VERCEL_TEAM_ID }}
          project-id: ${{ secrets.VERCEL_PROJECT_ID_VAULT }}
          scope: ${{ secrets.VERCEL_ORG_ID }}
        env:
          VERCEL_PROJECT_PRODUCTION_DEPLOYMENT: 'true'
      
      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '✅ Vault built and deployed successfully! 🚀'
            })
      
      - name: Slack Notification
        if: failure()
        uses: slackapi/slack-github-action@v1.24.0
        with:
          payload: |
            {
              "text": "❌ Vault deployment failed",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Vault Deployment Failed*\nCommit: ${{ github.sha }}\nAuthor: ${{ github.actor }}"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

### Workflow 4: Dependency Validation

**File:** `.github/workflows/validate-deps.yml`

```yaml
name: Validate Dependencies

on:
  pull_request:
    paths:
      - 'package.json'
      - 'packages/**/package.json'
      - 'pnpm-lock.yaml'
  push:
    branches: [main]
    paths:
      - 'package.json'
      - 'packages/**/package.json'
      - 'pnpm-lock.yaml'

jobs:
  validate:
    name: Check Duplicate Dependencies & Circular Imports
    runs-on: ubuntu-latest
    timeout-minutes: 10
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Validate dependencies
        run: pnpm run deps:check
```

---

### Workflow 5: Code Quality & Security

**File:** `.github/workflows/code-quality.yml`

```yaml
name: Code Quality & Security

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  quality:
    name: Code Quality Checks
    runs-on: ubuntu-latest
    timeout-minutes: 20
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Run SonarQube Scanner
        uses: SonarSource/sonarcloud-github-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
      
      - name: Check for vulnerabilities
        run: pnpm audit --audit-level=moderate
        continue-on-error: true
```

---

## 3. Secrets Configuration

Set these in GitHub Secrets (Settings → Secrets and variables → Actions):

```
VERCEL_TOKEN              # From Vercel account settings
VERCEL_TEAM_ID            # From Vercel team settings
VERCEL_ORG_ID             # From Vercel organization
VERCEL_PROJECT_ID_FINTRACKER
VERCEL_PROJECT_ID_VAULT
SLACK_WEBHOOK_URL         # For notifications
SONAR_TOKEN               # For SonarQube (optional)
```

---

## 4. Branch Protection Rules

**GitHub Settings → Branches → Add Rule**

### Rule for `main` branch:

```yaml
Branch name pattern: main

Require status checks to pass before merging:
  ✓ CI - Lint, Test, Type Check
  ✓ Code Quality & Security
  ✓ Validate Dependencies

Require code reviews:
  ✓ Require pull request reviews before merging
  ✓ Require review from Code Owners
  ✓ Dismiss stale review approvals
  ✓ Require review of the most recent push

Require branches to be up to date:
  ✓ Require branches to be up to date before merging

Require conversation resolution:
  ✓ Require all conversations on code resolved

Require status checks to pass:
  ✓ Require branches to be up to date before merging
```

---

## 5. Codeowners Configuration

**File:** `.github/CODEOWNERS`

```
# Global owners
* @primary-maintainer @secondary-maintainer

# Shared packages
/packages/shared/ @ui-team @core-team
/packages/shared/ui/ @ui-team
/packages/shared/types/ @core-team
/packages/shared/config/ @devops-team
/packages/shared/utils/ @core-team

# Apps
/packages/apps/fintracker/ @fintracker-team
/packages/apps/vault/ @vault-team

# Infrastructure
/.github/ @devops-team
/vercel.json @devops-team
/turbo.json @devops-team
```

---

## 6. Deployment Strategies

### Strategy 1: Auto-Deploy on Main

```yaml
# On push to main → Automatic deployment
on:
  push:
    branches: [main]
    paths:
      - 'packages/apps/fintracker/**'
      - 'packages/shared/**'
```

### Strategy 2: Manual Approval for Production

Add job with approval:

```yaml
  approval:
    name: Manual Approval
    runs-on: ubuntu-latest
    needs: build
    environment:
      name: production
      required_reviewers: [release-team]
    
    steps:
      - name: Approved for deployment
        run: echo "Manual approval received, deploying..."
```

### Strategy 3: Staging First, Then Production

```yaml
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    # Deploy to staging immediately
    
  deploy-production:
    name: Deploy to Production
    needs: [build, deploy-staging]
    runs-on: ubuntu-latest
    environment:
      name: production
    # Deploy to production after staging succeeds
```

---

## 7. Monitoring & Notifications

### Slack Integration

Add to workflow steps:

```yaml
- name: Notify Slack - Build Success
  uses: slackapi/slack-github-action@v1.24.0
  if: success()
  with:
    payload: |
      {
        "text": "✅ Build succeeded",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Build Successful* 🎉\n${{ github.event.head_commit.message }}"
            }
          }
        ]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

- name: Notify Slack - Build Failure
  uses: slackapi/slack-github-action@v1.24.0
  if: failure()
  with:
    payload: |
      {
        "text": "❌ Build failed",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Build Failed* ❌\n<${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|View Details>"
            }
          }
        ]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## 8. Performance Optimization

### Cache Strategy

**In workflows:**

```yaml
- name: Cache Node modules
  uses: actions/setup-node@v4
  with:
    node-version: 20.x
    cache: 'pnpm'  # Automatic caching of pnpm-lock.yaml

- name: Cache Turbo build
  uses: actions/cache@v3
  with:
    path: .turbo
    key: ${{ runner.os }}-turbo-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-turbo-
```

### Parallel Jobs

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    # Runs in parallel
    
  test:
    runs-on: ubuntu-latest
    # Runs in parallel
    
  build:
    needs: [lint, test]  # Only runs after both complete
    runs-on: ubuntu-latest
```

---

## 9. Testing Checklist

After setting up CI/CD:

- [ ] CI workflow runs on PR creation
- [ ] All checks pass before merge
- [ ] Lint errors block merge
- [ ] Type errors block merge
- [ ] Test failures block merge
- [ ] Fintracker deploys on merge to main
- [ ] Vault deploys on merge to main
- [ ] Only affected app deploys (optimization)
- [ ] Slack notifications sent
- [ ] CODEOWNERS review required

---

## 10. Troubleshooting

### Workflow Doesn't Trigger

**Problem:** Workflow not running on push

**Solution:**
1. Check file is in `.github/workflows/`
2. Check `on:` trigger matches your push
3. Check `paths:` filter (if used) matches your changes
4. View "Actions" tab for workflow status
5. Check syntax with `yamllint`

### Build Cache Not Working

**Problem:** Always rebuilds, even with no changes

**Solution:**
1. Check `cache: 'pnpm'` is set in setup-node
2. Ensure `pnpm-lock.yaml` is committed
3. Check hash of lock file changed
4. Clear cache manually in Actions tab

### Deployment Not Triggering

**Problem:** Push to main doesn't deploy

**Solution:**
1. Verify `VERCEL_TOKEN` secret is set
2. Check `vercel/action` configuration
3. Ensure paths filter matches your changes
4. Review deployment logs in Vercel dashboard

---

## Next Steps

1. Create all workflow files
2. Add secrets to GitHub
3. Configure branch protection
4. Set up CODEOWNERS
5. Test with PR
6. Monitor first deployment
7. Document team workflows
