#!/bin/bash
set -e

cd "$(dirname "$0")"

# Check prerequisites
if ! command -v clasp &> /dev/null; then
  echo "❌ clasp not found. Install: npm install -g @google/clasp"
  exit 1
fi

echo "→ Pushing code to Apps Script..."
clasp push --force

DEPLOY_ID_FILE="gas/.deployment-id"
DEPLOYMENT_ID=""

if [ -f "$DEPLOY_ID_FILE" ]; then
  DEPLOYMENT_ID=$(tr -d '[:space:]' < "$DEPLOY_ID_FILE")
fi

if [ -z "$DEPLOYMENT_ID" ] && [ -f "web/.env" ]; then
  DEPLOYMENT_URL=$(sed -n 's/^VITE_GAS_URL=//p' "web/.env" | head -n 1)
  if [[ "$DEPLOYMENT_URL" =~ /macros/s/([^/]+)/exec ]]; then
    DEPLOYMENT_ID="${BASH_REMATCH[1]}"
  fi
fi

if [ -z "$DEPLOYMENT_ID" ]; then
  LATEST_DEPLOYMENT=$(clasp deployments 2>/dev/null | tail -n +2 | head -n 1 | awk '{print $2}')
  if [ -n "$LATEST_DEPLOYMENT" ]; then
    DEPLOYMENT_ID="$LATEST_DEPLOYMENT"
  fi
fi

if [ -n "$DEPLOYMENT_ID" ]; then
  echo "→ Updating existing deployment: $DEPLOYMENT_ID"
  DEPLOY_OUTPUT=$(clasp deploy --deploymentId "$DEPLOYMENT_ID" --description "Deploy $(date +'%Y-%m-%d %H:%M')" 2>&1)
else
  echo "→ Creating deployment..."
  DEPLOY_OUTPUT=$(clasp deploy --description "Deploy $(date +'%Y-%m-%d %H:%M')" 2>&1)
  # Extract deployment ID from "Deployed [ID] @[number]" format
  DEPLOYMENT_ID=$(echo "$DEPLOY_OUTPUT" | sed -n 's/.*Deployed \([^ ]*\) @.*/\1/p')
fi

if [ -z "$DEPLOYMENT_ID" ]; then
  echo "⚠ Failed to extract deployment ID"
  echo "Deploy output: $DEPLOY_OUTPUT"
  exit 1
fi

echo "✓ Deployed with ID: $DEPLOYMENT_ID"
printf '%s\n' "$DEPLOYMENT_ID" > "$DEPLOY_ID_FILE"

if [ -n "$API_TOKEN" ]; then
  echo ""
  echo "→ Setting API token in Script Properties..."
  clasp run setApiToken --params "[\"$API_TOKEN\"]" && echo "✓ API token set" || echo "⚠ clasp run failed — set token manually"
fi

echo ""
echo "→ Verifying deployment..."
sleep 2
RESPONSE=$(curl -sL "https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec?action=init" 2>/dev/null | head -c 50)
if echo "$RESPONSE" | grep -q "ok\|data"; then
  echo "✓ Deployment is working"

  GAS_URL="https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec"
  echo ""
  echo "📋 Deployment ID: $DEPLOYMENT_ID"
  echo "🔗 URL: $GAS_URL"

  CURRENT_GAS_URL=""
  if [ -f "web/.env" ]; then
    CURRENT_GAS_URL=$(sed -n 's/^VITE_GAS_URL=//p' "web/.env" | head -n 1)
  fi

  if [ "$CURRENT_GAS_URL" != "$GAS_URL" ]; then
    # Update .env file
    echo ""
    echo "→ Updating .env file..."
    if [ -f "web/.env" ]; then
      if grep -q '^VITE_GAS_URL=' "web/.env"; then
        sed -i '' "s|^VITE_GAS_URL=.*|VITE_GAS_URL=$GAS_URL|" "web/.env"
      else
        printf '\nVITE_GAS_URL=%s\n' "$GAS_URL" >> "web/.env"
      fi
      echo "✓ .env updated"
    else
      echo "⚠ web/.env not found"
    fi
  else
    echo ""
    echo "✓ GAS URL unchanged; skipping .env update"
  fi
else
  echo "⚠ Deployment returned unexpected response: $RESPONSE"
  echo ""
  echo "This is expected on first deployment. Complete these steps:"
  echo "1. Open: https://script.google.com"
  echo "2. Click 'Editor' (left sidebar)"
  echo "3. Find the latest deployment"
  echo "4. Click 'Manage deployments' ⚙️"
  echo "5. Edit the new deployment"
  echo "6. Set 'Who has access' → 'Anyone'"
  echo "7. Save"
fi

echo ""
echo "✅ GAS deployment complete!"
echo ""
echo "Next steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1️⃣  REQUIRED: Set GAS deployment permissions"
echo "   → Open: https://script.google.com"
echo "   → Manage deployments → Edit latest → Who has access → Anyone"
echo ""
echo "2️⃣  OPTIONAL: Update Vercel env vars if the GAS URL changed"
echo "   → Set VITE_GAS_URL in each Vercel project to the URL above"
echo ""
echo "3️⃣  CREATE: Savings sheet in FinanceTrackerAssets"
echo "   → Open spreadsheet"
echo "   → Insert new sheet → Name: 'Savings'"
echo "   → (Headers auto-created by GAS on first API call)"
echo ""
echo "4️⃣  TEST: Frontend"
echo "   → cd web && npm run dev"
echo "   → Open http://localhost:5173/fintracker and http://localhost:5173/vault"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
