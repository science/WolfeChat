#!/bin/bash

# Reset test environment by clearing localStorage keys that might contain stale model settings
echo "Resetting test environment..."

# Clear node localStorage (if exists)
rm -f ~/.local/share/node-localstorage/* 2>/dev/null

# Clear any test build cache
rm -rf .test-build/* 2>/dev/null

echo "Test environment reset complete."
echo "Default model will be set to gpt-5-nano for tests."