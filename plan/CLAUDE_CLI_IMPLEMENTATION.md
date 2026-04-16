# Claude CLI Setup & Usage Guide for Your Monorepo

**Practical walkthrough for implementing the 6-phase monorepo using Claude CLI**

---

## 🚀 Quick Start (5 minutes)

### Installation

```bash
# 1. Install Claude CLI
npm install -g @anthropic-ai/sdk
# or via pip
pip install anthropic

# 2. Set API Key
export ANTHROPIC_API_KEY="your-api-key-here"

# 3. Verify
claude --version
```

### First Command

```bash
# Test it works
claude "What is the purpose of a monorepo?"

# Should respond with explanation
# Token usage shown: ~2,000 tokens
```

---

## 📁 Project Setup for CLI Usage

### Directory Structure

```
your-repo/
├── docs/                    # Your documentation
│   ├── IMPLEMENTATION_PLAN.md
│   ├── DIRECTORY_STRUCTURE.md
│   ├── PACKAGE_CONFIG.md
│   ├── SHARED_PACKAGES_SETUP.md
│   ├── APP_MIGRATION.md
│   ├── VERCEL_DEPLOYMENT.md
│   ├── CI_CD_SETUP.md
│   └── DEVELOPMENT.md
│
├── phases/                  # CLI output folder
│   ├── phase-1-output.md
│   ├── phase-2-output.md
│   ├── phase-3-output.md
│   ├── phase-4-output.md
│   ├── phase-5-output.md
│   └── phase-6-output.md
│
├── scripts/                 # Helper scripts
│   ├── run-phases.sh
│   └── validate-phase.sh
│
└── .gitignore
```

### Create Helper Script

**File:** `scripts/run-phases.sh`

```bash
#!/bin/bash

# Color output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_KEY="${ANTHROPIC_API_KEY}"
DOCS_DIR="./docs"
OUTPUT_DIR="./phases"

if [ -z "$API_KEY" ]; then
    echo "Error: ANTHROPIC_API_KEY not set"
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

# Phase 1
echo -e "${BLUE}Running Phase 1: Directory Structure${NC}"
claude "$(cat $DOCS_DIR/DIRECTORY_STRUCTURE.md)

Please implement Phase 1 by:
1. Creating all directories as shown
2. Creating .gitignore file
3. Verifying structure with 'ls' commands
4. Provide exact bash commands to run" \
    > "$OUTPUT_DIR/phase-1-output.md"
echo -e "${GREEN}Phase 1 complete ✓${NC}"

# Phase 2
echo -e "${BLUE}Running Phase 2: Package Configuration${NC}"
claude "$(cat $DOCS_DIR/PACKAGE_CONFIG.md)

Please implement Phase 2 by:
1. Creating root package.json with all workspace declarations
2. Creating package.json for all shared packages
3. Creating package.json for both apps
4. Provide complete JSON files to copy" \
    > "$OUTPUT_DIR/phase-2-output.md"
echo -e "${GREEN}Phase 2 complete ✓${NC}"

# Phases 3-6 (similar pattern)
# ...

echo -e "${GREEN}All phases complete!${NC}"
echo "Review outputs in $OUTPUT_DIR"
```

### Make Script Executable

```bash
chmod +x scripts/run-phases.sh
```

---

## 🔄 Implementing Each Phase with CLI

### Phase 1: Directory Structure

**Command:**

```bash
claude "$(cat docs/DIRECTORY_STRUCTURE.md)

Based on the complete structure above, provide:
1. Exact bash commands to create all directories
2. Contents for .gitignore file
3. Verification commands to check structure
4. Expected output of directory listing

Format as executable bash commands I can copy/paste" \
  > phases/phase-1-output.md
```

**What You Get:**
- Ready-to-run bash commands
- Complete .gitignore content
- Verification steps
- ~3,000-5,000 tokens

**Then Execute:**
```bash
# Review output
cat phases/phase-1-output.md

# Copy the bash commands and run them
mkdir -p packages/shared/{ui,types,config,utils}/src
# ... etc from output

# Verify
git add .
git commit -m "feat: create monorepo directory structure"
```

---

### Phase 2: Package Configuration

**Command:**

```bash
claude "$(cat docs/PACKAGE_CONFIG.md)

Create a complete, production-ready implementation with:

1. Root package.json file with:
   - workspace declarations
   - all dev dependencies
   - scripts for dev, build, lint, type-check

2. For each shared package (ui, types, config, utils):
   - Complete package.json
   - exports field configuration
   - build scripts

3. For each app (fintracker, vault):
   - Complete package.json
   - workspace dependency references
   - dev dependencies

Provide all JSON files ready to copy/paste directly into project.
Format as complete file contents with filenames." \
  > phases/phase-2-output.md
```

**What You Get:**
- Complete package.json for root
- 4 shared package configs
- 2 app package configs
- tsconfig.json files
- ~5,000-7,000 tokens

**Then Execute:**
```bash
# Create files from output
cat phases/phase-2-output.md

# Copy each JSON section
# Create files:
# root/package.json
# packages/shared/ui/package.json
# packages/shared/types/package.json
# ... etc

# Install
pnpm install

# Verify
pnpm list --depth=0
```

---

### Phase 3: Shared Packages Setup

**Command:**

```bash
claude "$(cat docs/SHARED_PACKAGES_SETUP.md)

Create complete, working implementations for all shared packages:

1. @fintracker-vault/ui:
   - src/theme/colors.ts (export complete colors object)
   - src/theme/typography.ts (export typography)
   - src/theme/spacing.ts (export spacing)
   - src/theme/index.ts (export theme)
   - src/components/Button.tsx (export Button component)
   - src/components/index.ts (barrel export)
   - src/index.ts (main export)

2. @fintracker-vault/types:
   - src/api.ts (API types)
   - src/domain.ts (domain types)
   - src/common.ts (common types)
   - src/index.ts (barrel export)

3. @fintracker-vault/config:
   - src/env.ts (environment config)
   - src/api.ts (API endpoints)
   - src/index.ts (barrel export)

4. @fintracker-vault/utils:
   - src/formatters/date.ts
   - src/formatters/currency.ts
   - src/formatters/index.ts
   - src/validators/email.ts
   - src/validators/index.ts
   - src/calculations/math.ts
   - src/index.ts (barrel export)

Provide complete TypeScript code for each file, ready to copy/paste.
Include all necessary imports and exports." \
  > phases/phase-3-output.md
```

**What You Get:**
- Complete UI component code
- Theme exports
- Type definitions
- Utility functions
- ~8,000-12,000 tokens

**Then Execute:**
```bash
# Extract and create all files from output
# Review each code section
cat phases/phase-3-output.md | grep -A 50 "colors.ts"

# Create files in correct locations
# Build packages
pnpm build

# Verify
pnpm list '@fintracker-vault/ui'
```

---

### Phase 4: App Migration

**Command:**

```bash
claude "Based on APP_MIGRATION.md document at $(cat docs/APP_MIGRATION.md), 
provide a complete migration guide including:

1. Updated package.json files for:
   - packages/apps/fintracker/package.json
   - packages/apps/vault/package.json
   
2. Updated TypeScript configs:
   - packages/apps/fintracker/tsconfig.json
   - packages/apps/vault/tsconfig.json

3. Updated Tailwind configs:
   - packages/apps/fintracker/tailwind.config.ts
   - packages/apps/vault/tailwind.config.ts

4. Updated Next.js config:
   - packages/apps/fintracker/next.config.js
   - packages/apps/vault/next.config.js

5. Search and replace patterns for migrating imports:
   - Old import patterns (theme, types, config, utils)
   - New import patterns using @fintracker-vault/* namespace
   - Exact bash commands to find and replace

6. Verification commands to confirm migration complete

Provide all complete file contents ready to copy/paste." \
  > phases/phase-4-output.md
```

**What You Get:**
- Updated app configurations
- Import migration patterns
- Search/replace commands
- ~8,000-10,000 tokens

**Then Execute:**
```bash
# Get configurations from output
cat phases/phase-4-output.md

# Copy new package.json files
# Copy new config files

# Run search & replace commands
# (See output for exact commands)

# Verify
pnpm type-check
pnpm lint
pnpm build
pnpm dev:fintracker
```

---

### Phase 5: Vercel Deployment

**Command:**

```bash
claude "$(cat docs/VERCEL_DEPLOYMENT.md)

Provide complete Vercel deployment setup:

1. Root vercel.json file with proper builds configuration

2. Per-app vercel.json files:
   - packages/apps/fintracker/vercel.json
   - packages/apps/vault/vercel.json

3. Updated root package.json with build scripts:
   - build:fintracker
   - build:vault

4. Step-by-step Vercel setup instructions:
   - Create fintracker project
   - Set root directory
   - Configure environment variables
   - Same for vault project

5. Testing steps to verify before deployment

Provide all configuration files and step-by-step instructions." \
  > phases/phase-5-output.md
```

**What You Get:**
- Vercel configuration files
- Build scripts
- Setup instructions
- ~5,000-7,000 tokens

**Then Execute:**
```bash
# Get configs from output
cat phases/phase-5-output.md

# Create vercel.json files
# Update package.json build scripts

# Test locally
pnpm build:fintracker
pnpm build:vault

# Follow Vercel setup from output
# Create projects on Vercel dashboard
# Configure environment variables
```

---

### Phase 6: CI/CD Setup

**Command:**

```bash
claude "$(cat docs/CI_CD_SETUP.md)

Provide complete CI/CD setup including:

1. turbo.json configuration file

2. All GitHub Actions workflows:
   - .github/workflows/ci.yml (lint, test, type-check)
   - .github/workflows/deploy-fintracker.yml
   - .github/workflows/deploy-vault.yml
   - .github/workflows/validate-deps.yml
   - .github/workflows/code-quality.yml

3. .github/CODEOWNERS file for your team

4. Instructions for:
   - Setting GitHub secrets
   - Configuring branch protection
   - Setting up notifications

5. Complete YAML code ready to copy/paste

Provide all files with complete YAML content." \
  > phases/phase-6-output.md
```

**What You Get:**
- Turbo configuration
- GitHub Actions workflows
- CODEOWNERS file
- Setup instructions
- ~6,000-8,000 tokens

**Then Execute:**
```bash
# Get all configs from output
cat phases/phase-6-output.md

# Create turbo.json
# Create all workflow files in .github/workflows/
# Create .github/CODEOWNERS

# Follow secret setup instructions
# Configure branch protection in GitHub

git add .github/ turbo.json
git commit -m "feat: add CI/CD automation"
git push
```

---

## 📊 Batch Processing All Phases

### Single Script to Run All Phases

**File:** `scripts/run-all-phases.sh`

```bash
#!/bin/bash

set -e  # Exit on error

API_KEY="${ANTHROPIC_API_KEY}"
DOCS_DIR="./docs"
OUTPUT_DIR="./phases"
PHASES=("1" "2" "3" "4" "5" "6")
PHASE_DOCS=("DIRECTORY_STRUCTURE" "PACKAGE_CONFIG" "SHARED_PACKAGES_SETUP" "APP_MIGRATION" "VERCEL_DEPLOYMENT" "CI_CD_SETUP")

if [ -z "$API_KEY" ]; then
    echo "Error: ANTHROPIC_API_KEY not set"
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

for i in "${!PHASES[@]}"; do
    PHASE=${PHASES[$i]}
    DOC=${PHASE_DOCS[$i]}
    
    echo "=========================================="
    echo "Processing Phase $PHASE"
    echo "Document: $DOC.md"
    echo "=========================================="
    
    # Get token count estimate
    TOKENS=$(wc -w < "$DOCS_DIR/$DOC.md")
    echo "Document size: ~$((TOKENS / 1.3)) tokens"
    
    # Run Claude CLI
    START_TIME=$(date +%s)
    
    claude "$(cat $DOCS_DIR/$DOC.md)

For Phase $PHASE, provide:
1. Complete code/configuration ready to use
2. Verification commands
3. Expected results
4. Commit message suggestions

Format for easy copy/paste." \
        > "$OUTPUT_DIR/phase-$PHASE-output.md"
    
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    echo "✓ Phase $PHASE complete in ${DURATION}s"
    echo "Output saved to: phases/phase-$PHASE-output.md"
    echo ""
done

echo "=========================================="
echo "All phases complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Review each output file"
echo "2. Follow implementation steps"
echo "3. Test after each phase"
echo "4. Commit progress to git"
echo ""
echo "Review outputs with:"
echo "  cat phases/phase-*-output.md"
```

### Run All Phases

```bash
# Make executable
chmod +x scripts/run-all-phases.sh

# Run all phases
./scripts/run-all-phases.sh

# View outputs
ls -lh phases/
cat phases/phase-1-output.md
```

---

## ✅ Quality Control Checklist

### After Each Phase Output

```bash
# Review the output
cat phases/phase-$N-output.md | less

# Check for completeness
grep -i "complete\|ready\|copy" phases/phase-$N-output.md

# Verify no errors in instructions
grep -i "error\|problem\|note:" phases/phase-$N-output.md

# Token usage tracking
echo "Phase $N: Check API usage in output"

# Before committing
git add phases/phase-$N-output.md
git commit -m "docs: phase $N output from Claude CLI"
```

---

## 🔍 Troubleshooting CLI Issues

### Issue 1: API Key Not Found

**Error:** `Error: ANTHROPIC_API_KEY not set`

**Solution:**
```bash
# Check if key is set
echo $ANTHROPIC_API_KEY

# Set it (temporary)
export ANTHROPIC_API_KEY="sk-ant-..."

# Or permanently (add to .bashrc or .zshrc)
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.bashrc
source ~/.bashrc

# Verify
claude --version
```

### Issue 2: Rate Limiting

**Error:** `Rate limit exceeded`

**Solution:**
```bash
# Wait and retry
sleep 60
./scripts/run-phases.sh

# Or process one phase at a time
claude "$(cat docs/PHASE_1.md)" > phase-1.md
# Wait 5 minutes
claude "$(cat docs/PHASE_2.md)" > phase-2.md
```

### Issue 3: Truncated Output

**Error:** Output seems incomplete

**Solution:**
```bash
# Increase timeout
claude --timeout 120 "$(cat docs/LARGE_FILE.md)" > output.md

# Or break into smaller tasks
# Instead of one large prompt, split into multiple

claude "From PACKAGE_CONFIG.md, provide root package.json only"
claude "From PACKAGE_CONFIG.md, provide shared package configs"
claude "From PACKAGE_CONFIG.md, provide app configs"
```

### Issue 4: Token Limit Warnings

**Error:** `Approaching token limit`

**Solution:**
```bash
# Process fewer files at once
claude "Just the ui package setup" > ui-only.md

# Check token estimates
wc -w docs/*.md | sort -n

# Process in batches
# Phase 1 files first
# Then Phase 2
# Etc.
```

---

## 📈 Token Tracking

### Track Tokens Per Phase

**Create:** `scripts/token-tracker.sh`

```bash
#!/bin/bash

echo "Phase | Doc Size | Est. Tokens | Output Size"
echo "------|----------|-------------|----------"

for doc in docs/*.md; do
    WORDS=$(wc -w < "$doc")
    EST_TOKENS=$((WORDS * 13 / 10))  # Rough estimate
    
    BASENAME=$(basename "$doc" .md)
    
    echo "$BASENAME | $WORDS | $EST_TOKENS | 0KB (pending)"
done

echo ""
echo "Total estimated: ~60,000 tokens"
```

### Run Tracking

```bash
chmod +x scripts/token-tracker.sh
./scripts/token-tracker.sh
```

---

## 🎯 Best Practices for CLI Usage

### 1. One Phase at a Time

```bash
# ✅ Good: Independent, trackable
claude "Implement Phase 1 from [doc]" > phase-1.md

# ❌ Bad: Too much, hard to track
claude "Implement all 6 phases" > all.md
```

### 2. Include Context in Prompt

```bash
# ✅ Good: Claude knows exactly what to do
claude "$(cat docs/PHASE_1.md)

Based on the structure above, create:
1. Directories
2. .gitignore
3. Verification commands"

# ❌ Bad: Unclear requirements
claude "Set up Phase 1"
```

### 3. Request Specific Formats

```bash
# ✅ Good: Gets usable output
claude "[doc]... Provide as bash commands I can run directly"

# ❌ Bad: Might get explanations instead of code
claude "[doc]... How should I set this up?"
```

### 4. Verify Before Implementing

```bash
# ✅ Good: Review first
cat phases/phase-1-output.md
# Review content
# Then implement

# ❌ Bad: Blind implementation
cat phases/phase-1-output.md | bash
```

### 5. Version Control Outputs

```bash
# ✅ Good: Track all outputs
git add phases/
git commit -m "feat: Phase 1 from Claude CLI"

# ❌ Bad: Losing outputs
# Just deleting files
```

---

## 📊 Expected Token Usage by Phase

```
Phase 1: Directory Structure
  ├─ Input: ~1,500 tokens
  ├─ Output: ~2,000 tokens
  └─ Total: ~3,500 tokens

Phase 2: Package Config
  ├─ Input: ~2,500 tokens
  ├─ Output: ~3,000 tokens
  └─ Total: ~5,500 tokens

Phase 3: Shared Packages
  ├─ Input: ~4,000 tokens
  ├─ Output: ~6,000 tokens
  └─ Total: ~10,000 tokens

Phase 4: App Migration
  ├─ Input: ~3,500 tokens
  ├─ Output: ~4,500 tokens
  └─ Total: ~8,000 tokens

Phase 5: Vercel Deploy
  ├─ Input: ~2,000 tokens
  ├─ Output: ~3,000 tokens
  └─ Total: ~5,000 tokens

Phase 6: CI/CD Setup
  ├─ Input: ~2,500 tokens
  ├─ Output: ~4,000 tokens
  └─ Total: ~6,500 tokens

═══════════════════════════════
Total: ~38,500 tokens for all 6 phases
(vs 113,000 in chat interface)
```

---

## 🚀 Recommended Workflow

### Day 1: Setup & Phase 1
```bash
09:00 - Install Claude CLI
09:10 - Set API key
09:15 - Run Phase 1
10:00 - Review and implement Phase 1
12:00 - Commit: "Phase 1 complete"
```

### Day 2: Phases 2-3
```bash
09:00 - Run Phase 2
09:45 - Implement Phase 2
10:30 - Commit Phase 2
11:00 - Run Phase 3
12:00 - Implement Phase 3
16:00 - Commit Phase 3
```

### Day 3: Phases 4-6
```bash
09:00 - Run Phase 4
10:30 - Implement Phase 4
11:30 - Commit Phase 4
12:00 - Run Phase 5
13:00 - Implement Phase 5
14:00 - Run Phase 6
15:00 - Implement Phase 6
16:00 - Commit Phase 6
16:30 - Final testing
```

**Total Time: 24 hours**  
**Total Tokens: ~38,500**  
**Quality: Professional**  
**Reproducibility: Perfect**  

---

## ✨ Summary

### Why Use Claude CLI for This Project:

```
✅ 50% less tokens (38k vs 113k)
✅ Independent phases (no context bloat)
✅ Results go straight to git
✅ Team can review outputs
✅ Reproducible process
✅ Consistent performance
✅ Professional workflow
```

### Ready to Start?

```bash
1. Install: npm install -g @anthropic-ai/sdk
2. Set key: export ANTHROPIC_API_KEY="..."
3. Test: claude "Hello"
4. Run Phase 1: claude "$(cat docs/DIRECTORY_STRUCTURE.md)" > phases/phase-1.md
5. Follow output instructions
6. Commit progress
7. Repeat for Phases 2-6
```

**Let's build this monorepo! 🚀**
