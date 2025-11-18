#!/usr/bin/env node

/**
 * Bundle OpenAPI specification
 * 
 * This script bundles the modular OpenAPI YAML files from src/openapi/
 * into a single bundled file in dist/openapi-bundled.yml for production use.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SRC_PATH = path.join(__dirname, '../src/openapi/index.yml');
const DIST_DIR = path.join(__dirname, '../dist');
const DIST_PATH = path.join(DIST_DIR, 'openapi-bundled.yml');

// Ensure dist directory exists
if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
}

console.log('[bundle-openapi] Bundling OpenAPI specification...');
console.log(`[bundle-openapi] Source: ${SRC_PATH}`);
console.log(`[bundle-openapi] Output: ${DIST_PATH}`);

try {
    // Use @redocly/openapi-cli to bundle the modular spec
    execSync(
        `npx @redocly/openapi-cli bundle "${SRC_PATH}" -o "${DIST_PATH}"`,
        { stdio: 'inherit' }
    );
    
    console.log('[bundle-openapi] ✅ OpenAPI bundling completed successfully');
} catch (error) {
    console.error('[bundle-openapi] ❌ OpenAPI bundling failed:', error.message);
    process.exit(1);
}
