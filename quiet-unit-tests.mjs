#!/usr/bin/env node
/**
 * Script to quiet down unit tests by converting console.* to debugLog calls
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function quietTestFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Check if file already imports debugLog
  const hasDebugImport = content.includes("from '../utils/debugLog") || content.includes('from "../utils/debugLog');

  if (!hasDebugImport) {
    // Find the last import statement to add our import after it
    const importLines = content.split('\n');
    let lastImportIndex = -1;
    let inMultiLineImport = false;

    for (let i = 0; i < importLines.length; i++) {
      const line = importLines[i].trim();

      // Check if starting a new import
      if (line.startsWith('import ')) {
        lastImportIndex = i;
        // Check if it's a multi-line import (has opening brace but no closing brace with semicolon)
        if (line.includes('{') && !line.includes('} from')) {
          inMultiLineImport = true;
        } else {
          inMultiLineImport = false;
        }
      }
      // If in multi-line import, check if this line closes it
      else if (inMultiLineImport) {
        lastImportIndex = i;
        if (line.includes('} from')) {
          inMultiLineImport = false;
        }
      }
    }

    if (lastImportIndex >= 0) {
      importLines.splice(lastImportIndex + 1, 0, "import { debugInfo, debugWarn, debugErr } from '../utils/debugLog.js';");
      content = importLines.join('\n');
    }
  }

  // Convert console.log → debugInfo
  // Match console.log with any arguments
  content = content.replace(/console\.log\(/g, 'debugInfo(');

  // Convert console.warn → debugWarn
  content = content.replace(/console\.warn\(/g, 'debugWarn(');

  // Convert console.error → debugErr
  // But skip lines that assign to console.error (test mocking code)
  const lines = content.split('\n');
  const convertedLines = lines.map(line => {
    if (line.includes('console.error =') ||
        line.includes('console.log =') ||
        line.includes('console.warn =') ||
        line.includes('const originalConsole')) {
      return line;
    }
    return line.replace(/console\.error\(/g, 'debugErr(');
  });
  content = convertedLines.join('\n');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }

  return false;
}

// Get all test files
const testDir = path.join(__dirname, 'src/tests/unit');
const files = fs.readdirSync(testDir)
  .filter(f => f.endsWith('.test.ts') || f.endsWith('.spec.ts'))
  .map(f => path.join(testDir, f));

let modifiedCount = 0;
for (const file of files) {
  console.log(`Processing: ${path.basename(file)}`);
  if (quietTestFile(file)) {
    console.log(`  ✓ Modified`);
    modifiedCount++;
  } else {
    console.log(`  - No changes needed`);
  }
}

console.log(`\n✅ Modified ${modifiedCount} of ${files.length} files`);
