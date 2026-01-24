# AI Instructions for simple-sieve-generator

## Project Overview
This project is a Cloudflare Worker application built with Hono and TypeScript. It is designed to manage Sieve email filtering lists and generates Sieve scripts. It serves a simple HTML frontend and uses Cloudflare KV for data persistence.

## Project Structure
- `src/index.ts`: Main entry point. Contains both the backend API (Hono) and the frontend HTML generation.
- `wrangler.toml`: Cloudflare Workers configuration. Defines KV namespaces and compatibility settings.
- `package.json`: Dependencies and scripts.
- `.github/workflows/deploy-sieve-generator.yml`: CI/CD workflow for automatic deployment.

## Key Technologies
- **Cloudflare Workers**: Serverless runtime.
- **Hono**: Web framework for the worker.
- **Cloudflare KV**: Key-Value storage used to store lists.
- **Wrangler**: CLI for development and deployment.

## Security & Configuration Policy
- **NO SECRETS IN CODE**: Never commit API keys, tokens, or specific resource IDs (like KV Namespace IDs) to the repository.
- **GitHub Secrets**: All configuration values must be injected via GitHub Secrets during the CI/CD process.
- **Wrangler Config**: `wrangler.toml` must use placeholders or environment variable references (e.g., `id = "SIEVE_DATA_ID"`) that are replaced at build time.

## Development Workflow
1.  **Context**: Always check `package.json` and `wrangler.toml` to understand the environment.
2.  **KV Storage**: The app relies on `SIEVE_DATA` binding. When adding features that store data, ensure the KV logic in `src/index.ts` handles it correctly (keys, values).
3.  **Frontend**: The frontend is currently a simple string literal in `src/index.ts`. If requests become complex, consider separating it, but for now, keep it simple within the worker response.
4.  **Deployment**: Changes pushed to `main` are deployed via GitHub Actions. **ENSURE no configuration values are hardcoded.**
5. **Testing**: Testing will be done entirely in the github CI. Do not rely on local testing with npx/node.

## Future Roadmap (Todo)
- **Sieve Generation**: Logic to compile the stored lists into valid Sieve scripts.
- **Authentication**: Currently open; needs basic auth or Cloudflare Access protection if exposed publicly.

## Common Tasks
- **Adding a Route**: Add standard `app.get`, `app.post` etc. in `src/index.ts`.
- **Modifying UI**: Update the HTML string in the root route handler.
- **KV Operations**: Use `c.env.SIEVE_DATA.get()`, `.put()`, `.list()`, `.delete()`.
