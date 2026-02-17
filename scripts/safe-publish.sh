#!/bin/bash
# Safe npm publish — prevents ghost versions from burning version numbers.
#
# Strategy:
# 1. Pre-check: verify version doesn't already exist on npm
# 2. Dry-run: validate package before uploading
# 3. Publish with retry: if ghost detected, unpublish + retry once
# 4. If still blocked (24hr cooldown), bump patch and retry
set -e

PKG_NAME=$(node -p "require('./package.json').name")
PKG_VERSION=$(node -p "require('./package.json').version")

echo "Publishing ${PKG_NAME}@${PKG_VERSION}..."

# Step 1: Check if version already exists on npm
if npm view "${PKG_NAME}@${PKG_VERSION}" version 2>/dev/null; then
    echo "ERROR: ${PKG_NAME}@${PKG_VERSION} already exists on npm."
    echo "Bump the version first: npm version patch --no-git-tag-version"
    exit 1
fi

# Step 2: Dry-run to catch errors before uploading
echo "Running dry-run..."
if ! npm publish --dry-run 2>&1; then
    echo "ERROR: Dry-run failed. Fix issues before publishing."
    exit 1
fi

# Step 3: Actual publish
echo "Publishing..."
if npm publish 2>&1; then
    echo "Successfully published ${PKG_NAME}@${PKG_VERSION}"
    exit 0
fi

# Step 4: Publish failed — check for ghost version
echo "Publish failed. Checking for ghost version..."
sleep 5

if npm view "${PKG_NAME}@${PKG_VERSION}" version 2>/dev/null; then
    echo "Version was actually published (delayed propagation). Success!"
    exit 0
fi

# Ghost detected: version rejected but consumed
echo "Ghost version detected. Attempting unpublish + retry..."
if npm unpublish "${PKG_NAME}@${PKG_VERSION}" 2>/dev/null; then
    sleep 3
    if npm publish 2>&1; then
        echo "Successfully published ${PKG_NAME}@${PKG_VERSION} after ghost recovery."
        exit 0
    fi
fi

# Unpublish failed or republish blocked (24hr cooldown)
echo ""
echo "GHOST VERSION BURNED: ${PKG_NAME}@${PKG_VERSION}"
echo ""
echo "npm's 24-hour cooldown prevents reuse. Options:"
echo "  1. Bump patch:  npm version patch --no-git-tag-version"
echo "  2. Wait 24 hours and retry"
exit 1
