#!/bin/bash
set -e

echo "========================================="
echo "Running ALL Tests (Pre-Production Check)"
echo "========================================="
echo ""

echo "1️⃣  Running all unit tests..."
npm run test:all

echo ""
echo "2️⃣  Running all E2E tests..."
npx playwright test tests-e2e

echo ""
echo "✅ All tests passed!"
