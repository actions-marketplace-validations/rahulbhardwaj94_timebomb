#!/bin/bash
# Run this script to publish TimeBomb to npm.
# Prerequisites: npm login (run once before this script)
#
# Usage:
#   npm login          # authenticate once
#   bash publish.sh    # publish all three packages in order

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> Building all packages..."
npx tsc -p "$ROOT/packages/core/tsconfig.json"
npx tsc -p "$ROOT/packages/cli/tsconfig.json"
npx tsc -p "$ROOT/packages/action/tsconfig.json"

echo "==> Publishing timebomb-core..."
cd "$ROOT/packages/core"
npm publish --access public

echo "==> Publishing timebomb-scanner (CLI)..."
cd "$ROOT/packages/cli"
npm publish --access public

echo "==> Publishing timebomb-action..."
cd "$ROOT/packages/action"
npm publish --access public

echo ""
echo "✓ All packages published!"
echo "  npx timebomb-scanner          → timebomb-scanner on npm"
echo "  npm install -g timebomb-core  → core engine"
echo "  timebomb-action               → GitHub Action package"
