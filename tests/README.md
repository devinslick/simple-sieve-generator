# Generate Function Tests

This directory contains tests for the `/generate` endpoint of the Sieve Generator.

## Structure

```
tests/
├── README.md              # This file
└── generate/
    ├── test-config.json   # Test definitions
    ├── run-tests.js       # Test runner script
    ├── *.input            # Test input files (rules)
    └── *.expected         # Expected output files (sieve scripts)
```

## Adding a New Test

1. Add a test definition to `test-config.json`:
   ```json
   {
     "name": "my-test-name",
     "description": "Description of what this test covers",
     "folderName": "FolderName",
     "inputFile": "my-test-name.input",
     "expectedFile": "my-test-name.expected"
   }
   ```

2. Create the input file (`my-test-name.input`) with DSL rules.

3. Run the test with `--update-expected` to generate the expected output:
   ```bash
   npm run test:generate -- --update-expected --filter=my-test-name
   ```

4. Review the generated `.expected` file to ensure correctness.

## Running Tests Locally

1. Start the dev server in one terminal:
   ```bash
   npm run dev
   ```

2. In another terminal, run the tests:
   ```bash
   npm run test:generate
   ```

### Options

- `--server-url=URL` - Use a different server URL (default: http://localhost:8787)
- `--filter=NAME` - Run only tests whose name contains NAME
- `--update-expected` - Update expected files with actual output (use with caution)

## Running Tests in CI

The tests can be run via GitHub Actions:

1. Go to Actions → "Test Generate Function"
2. Click "Run workflow"
3. Optionally filter tests or update expected files
4. View the results in the workflow run

## Test Files

| Test | Description |
|------|-------------|
| `basic-subject-rules` | Basic subject matching with F, FR, FRS, FRAS, B, Fx |
| `from-rules` | From/sender address matching rules |
| `alias-rules` | Alias-based mailbox routing rules |
