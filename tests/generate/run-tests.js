#!/usr/bin/env node

/**
 * Test runner for the Sieve Generator's /generate endpoint.
 *
 * Usage:
 *   node tests/generate/run-tests.js [--server-url=URL]
 *
 * Options:
 *   --server-url=URL   Base URL of the server (default: http://localhost:8787)
 *   --update-expected  Update expected files with actual output (use with caution)
 *   --filter=NAME      Run only tests matching NAME
 *
 * The script reads test-config.json for test definitions
 * Each test has an input file (.input) and expected output file (.expected).
 */

const fs = require('fs');
const path = require('path');

const TEST_DIR = path.dirname(__filename);
const CONFIG_FILE = path.join(TEST_DIR, 'test-config.json');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  serverUrl: 'http://localhost:8787',
  updateExpected: false,
  filter: null
};

for (const arg of args) {
  if (arg.startsWith('--server-url=')) {
    options.serverUrl = arg.substring('--server-url='.length);
  } else if (arg === '--update-expected') {
    options.updateExpected = true;
  } else if (arg.startsWith('--filter=')) {
    options.filter = arg.substring('--filter='.length);
  }
}

async function loadConfig() {
  const content = fs.readFileSync(CONFIG_FILE, 'utf8');
  return JSON.parse(content);
}

async function loadFile(filename) {
  const filepath = path.join(TEST_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return null;
  }
  return fs.readFileSync(filepath, 'utf8');
}

async function saveFile(filename, content) {
  const filepath = path.join(TEST_DIR, filename);
  fs.writeFileSync(filepath, content, 'utf8');
}

async function callGenerate(serverUrl, folderName, rulesInput) {
  const response = await fetch(`${serverUrl}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderName, rulesInput })
  });

  if (!response.ok) {
    throw new Error(`Server returned ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return data.script;
}

function normalizeOutput(output) {
  // Normalize line endings and trim trailing whitespace
  return output
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();
}

function diffLines(expected, actual) {
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const diffs = [];

  const maxLines = Math.max(expectedLines.length, actualLines.length);
  for (let i = 0; i < maxLines; i++) {
    const expLine = expectedLines[i] || '';
    const actLine = actualLines[i] || '';
    if (expLine !== actLine) {
      diffs.push({
        line: i + 1,
        expected: expLine,
        actual: actLine
      });
    }
  }

  return diffs;
}

async function runTest(test, options) {
  const { name, description, folderName, inputFile, expectedFile } = test;

  console.log(`\n  Running: ${name}`);
  console.log(`    ${description}`);

  // Load input
  const input = await loadFile(inputFile);
  if (input === null) {
    console.log(`    ❌ SKIP - Input file not found: ${inputFile}`);
    return { name, status: 'skip', reason: 'Input file not found' };
  }

  // Call generate endpoint
  let actual;
  try {
    actual = await callGenerate(options.serverUrl, folderName, input);
  } catch (error) {
    console.log(`    ❌ FAIL - Server error: ${error.message}`);
    return { name, status: 'fail', reason: `Server error: ${error.message}` };
  }

  const normalizedActual = normalizeOutput(actual);

  // Update expected file if requested
  if (options.updateExpected) {
    await saveFile(expectedFile, normalizedActual);
    console.log(`    📝 Updated expected file: ${expectedFile}`);
    return { name, status: 'updated' };
  }

  // Load expected output
  const expected = await loadFile(expectedFile);
  if (expected === null) {
    console.log(`    ❌ SKIP - Expected file not found: ${expectedFile}`);
    console.log(`    Run with --update-expected to create it`);
    return { name, status: 'skip', reason: 'Expected file not found' };
  }

  const normalizedExpected = normalizeOutput(expected);

  // Compare
  if (normalizedActual === normalizedExpected) {
    console.log(`    ✅ PASS`);
    return { name, status: 'pass' };
  } else {
    const diffs = diffLines(normalizedExpected, normalizedActual);
    console.log(`    ❌ FAIL - Output mismatch`);
    console.log(`    First ${Math.min(5, diffs.length)} differences:`);
    for (const diff of diffs.slice(0, 5)) {
      console.log(`      Line ${diff.line}:`);
      console.log(`        Expected: ${diff.expected || '(empty)'}`);
      console.log(`        Actual:   ${diff.actual || '(empty)'}`);
    }
    if (diffs.length > 5) {
      console.log(`      ... and ${diffs.length - 5} more differences`);
    }
    return { name, status: 'fail', reason: 'Output mismatch', diffs };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Sieve Generator Test Runner');
  console.log('='.repeat(60));
  console.log(`Server URL: ${options.serverUrl}`);
  if (options.updateExpected) {
    console.log('Mode: UPDATE EXPECTED FILES');
  }
  if (options.filter) {
    console.log(`Filter: ${options.filter}`);
  }

  // Load config
  let config;
  try {
    config = await loadConfig();
  } catch (error) {
    console.error(`Failed to load config: ${error.message}`);
    process.exit(1);
  }

  // Filter tests if requested
  let tests = config.tests;
  if (options.filter) {
    tests = tests.filter(t => t.name.includes(options.filter));
  }

  if (tests.length === 0) {
    console.log('\nNo tests to run.');
    process.exit(0);
  }

  console.log(`\nRunning ${tests.length} test(s)...`);

  // Run tests
  const results = [];
  for (const test of tests) {
    const result = await runTest(test, options);
    results.push(result);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;
  const updated = results.filter(r => r.status === 'updated').length;

  console.log(`  Passed:  ${passed}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  if (updated > 0) {
    console.log(`  Updated: ${updated}`);
  }

  console.log('\n' + '='.repeat(60));

  // Exit with error code if any tests failed
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
