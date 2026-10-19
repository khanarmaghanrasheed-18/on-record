# On Record

An installable record book for friends' predictions. Friends join once by public ID, put their own answers on a dated claim, and later settle it for head-to-head points. AI checks that a claim can be judged fairly before it locks.

This repository is being built in the approved slices in [`devpost/checklist.md`](devpost/checklist.md). The current slice covers accounts and friend connections; the claim, settlement, and installation flows follow.

## Run the current app

1. Create a free [Supabase](https://supabase.com/) project. Keep the Data API enabled.
2. Run the SQL files in [`supabase/migrations`](supabase/migrations) in filename order in its SQL Editor. The second file repairs profile visibility on projects that already applied the first version.
3. Copy `.env.example` to `.env` and enter the project's URL and **publishable** key. Do not use a secret or service-role key in `VITE_` variables.
4. Run `npm install`, then `npm run dev`, and open the localhost address Vite prints.
5. Register two accounts, confirm their email addresses if the project requires it, then exchange one account's eight-character friend ID and accept the request in the other account's Friends tab.

`npm run build` checks TypeScript and produces the static site in `dist/`.

## Stack

React, TypeScript, Vite, Supabase Auth/Postgres, and later a Supabase Edge Function for Gemini clarity checks. Cloudflare Pages will host the finished web app over HTTPS so it can be added to a phone's home screen.

## Privacy

The app uses Supabase Row Level Security. The database migration permits signed-in people to see their own profile and friend connections. `.env` and the private learner profile are ignored by Git.
