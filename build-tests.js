#!/usr/bin/env node
/**
 * Build script for test files
 * Compiles TypeScript test files to JavaScript for execution
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildTests() {
  console.log('Building test files...');
  
  const buildDir = path.join(__dirname, '.test-build');
  
  // Clean build directory
  try {
    await fs.rm(buildDir, { recursive: true });
  } catch (e) {
    // Directory might not exist
  }
  await fs.mkdir(buildDir, { recursive: true });

  // Copy JavaScript files and mocks
  const jsFiles = [
    'src/tests/nonapi/svelte-code-shim.js',
    'src/tests/nonapi/__mocks__/svelte-markdown.js',
  ];
  
  for (const file of jsFiles) {
    const src = path.join(__dirname, file);
    const dest = path.join(buildDir, file);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
  }

  // Use esbuild to transpile TypeScript files
  try {
    await execAsync(`npx esbuild \
      src/tests/**/*.test.ts \
      src/tests/testHarness.ts \
      src/tests/chatScrollState.test.ts \
      src/tests/chatStreamingScroll.test.ts \
      src/utils/**/*.ts \
      src/managers/**/*.ts \
      src/stores/**/*.ts \
      test-runner.ts \
      --bundle \
      --platform=node \
      --target=node18 \
      --format=esm \
      --outdir=${buildDir} \
      --external:jsdom \
      --external:fast-glob \
      --external:svelte \
      --external:svelte/* \
      --external:openai \
      --external:idb \
      --external:prismjs \
      --external:sse.js \
      --loader:.svelte=js \
      --allow-overwrite`);
    
    console.log('Build completed successfully');
    return buildDir;
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

buildTests();