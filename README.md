# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## AI campaign generation setup

This project includes a Supabase Edge Function at `supabase/functions/generate-campaign-draft/index.ts`.

Deploy and configure it before using AI generation in the campaign wizard:

```sh
supabase functions deploy generate-campaign-draft
supabase secrets set OPENAI_API_KEY=your_key_here
# optional
supabase secrets set OPENAI_MODEL=gpt-4o-mini
supabase secrets set OPENAI_BASE_URL=https://api.openai.com/v1
```

If no AI secret is configured or provider calls fail, the app automatically falls back to local heuristic generation.

## Load testing and production-readiness checks

This repo includes repeatable load-test scripts for high-volume validation before going live:

```sh
# Public feedback submission path
npm run load:submit -- scripts/load/submit-feedback-load.config.example.json

# Admin dashboard read pressure
npm run load:admin -- scripts/load/admin-read-load.config.example.json
```

Important notes:

- `load:submit` supports two modes:
  - `public_edge`: exercises the real public Edge Function and anti-abuse protections.
  - `service_rpc`: staging-only throughput validation that bypasses browser/IP cooldown behavior so you can validate write capacity at scale.
- Public-edge mode needs enough unique active link codes. If you try to submit many requests through one code from one machine, the app is expected to rate-limit those requests.
- `load:admin` requires a valid authenticated admin JWT in `LOAD_TEST_ADMIN_JWT`.
- Both scripts write JSON reports to `load-test-results/`.

Use these with the detailed runbook in `docs/load-testing.md`.
