# Simple Sieve Generator

A Cloudflare Worker-based web app to manage Sieve email filtering lists and generate rules.

## Features
- **Cloudflare Workers**: Serverless compute.
- **Hono**: Fast, lightweight web framework.
- **Cloudflare KV**: Storage for exclusion lists and templates (Designed to run within the Cloudflare Workers Free Tier).
- **Auto-Deployment**: GitHub Actions workflow included.

## Security (Important!)
This application **does not** include built-in authentication. By default, anyone with the URL can view and edit your Sieve filters.

**Recommendation**: Protect the application using [Cloudflare Zero Trust / Access](https://www.cloudflare.com/products/zero-trust/access/).
1. Go to Cloudflare Zero Trust Dashboard.
2. Create an Application for your Worker's route (e.g., `simple-sieve-generator.your-subdomain.workers.dev`).
3. Set up a policy to allow only your email address.

## Setup

### Prerequisites
- Cloudflare Account
- (Optional) Node.js & npm if you wish to run the project locally

### Local Development

1. Install dependencies:
   ```bash
   cd simple-sieve-generator
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser at `http://localhost:8787` (or similar).

### Configuration & Deployment

This project uses GitHub Actions for deployment. All sensitive configuration values (like API tokens and KV IDs) are securely stored in **GitHub Secrets**, not in the source code.

#### 1. Cloudflare API Token
1. Go to the [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens).
2. Create a Token using the **Edit Cloudflare Workers** template.
3. Copy the token.

#### 2. KV Namespaces
You need to create two KV namespaces (Production and Preview):
1. Go to the **Cloudflare Dashboard** > **Workers & Pages** > **KV**.
2. Click **Create a namespace**. call it `SIEVE_DATA`.
3. Click **Create a namespace** again. Call it `SIEVE_DATA_PREVIEW`.
4. Copy the **ID** for both namespaces.

#### 3. GitHub Secrets
Go to your GitHub Repository **Settings > Secrets and variables > Actions** and add the following Repository Secrets:

| Secret Name | Description |
|-------------|-------------|
| `CLOUDFLARE_API_TOKEN` | Your API Token from step 1. |
| `SIEVE_DATA_ID` | The ID of your production KV namespace. |
| `SIEVE_DATA_PREVIEW_ID` | The ID of your preview KV namespace. |

Once these are set, pushing to the `main` branch will automatically inject these IDs into the configuration and deploy your worker.

### Usage
- Visit the app URL (e.g., `https://simple-sieve-generator.devin.workers.dev`).
- Create/Edit lists (e.g., `exclusions/global.txt`) using the web UI.
