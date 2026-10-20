# On Record

An installable record book for friends' predictions. Friends connect once by public ID, write their original answers, let AI check the claim's clarity, and settle the outcome for head-to-head points. Group claims count for each correct-versus-wrong pair.

**Build status:** the core code is present. Two accounts connected, a clear claim locked, and claim revision worked in live testing; settlement, scores, and phone installation still need verification. See [`devpost/checklist.md`](devpost/checklist.md) for the exact remaining checks.

## How the parts fit

- **React** renders the phone and desktop screens. **Vite** runs the local development server and creates the static production build.
- **Supabase Auth/Postgres** stores accounts, friendships, original answers, votes, and outcomes. Database functions enforce claim and score rules.
- A **Supabase Edge Function** sends the group's wording to Gemini. The Gemini key stays on the server. A rejected or unavailable AI check leaves answers editable.
- **Cloudflare Pages** hosts the static app over HTTPS. The web manifest, icons, and service worker let people add it to a phone home screen. Live claims still need internet access.

## Local setup

1. Use Node.js 20.19+ and run `npm install`.
2. Copy `.env.example` to `.env`. Fill in your Supabase project URL and **publishable** key. Never put a secret key or Gemini key in a `VITE_` variable; those values are shipped to browsers.
3. In Supabase **SQL Editor**, run files from [`supabase/migrations`](supabase/migrations) in filename order, once each. For the existing On Record project, the owner reports all migrations through `202610200004_locked_answer_edits.sql` have run successfully; do not rerun them during local setup.
4. In Supabase **Edge Functions**, deploy or redeploy `clarify-claim` using [`supabase/functions/clarify-claim/index.ts`](supabase/functions/clarify-claim/index.ts). The existing project needs this redeploy for the updated yes/no clarity guidance. If deploying in the Dashboard editor, keep its legacy **Verify JWT** gateway switch off; this function validates the signed-in user's token itself. The repo's [`supabase/config.toml`](supabase/config.toml) sets `verify_jwt = false` for CLI deployments.
5. In **Edge Function Secrets**, add `GEMINI_API_KEY` privately. Do not paste it into chat or commit it. Supabase provides its own server keys to the function. The default model is `gemini-3.5-flash-lite`; `GEMINI_MODEL` is an optional server-side override.
6. Run `npm run dev` and open the printed localhost URL. `npm run build` checks TypeScript and creates `dist/`; `npm run preview` serves that production build locally.

The function requires an active signed-in session. The `verify_jwt = false` setting only bypasses Supabase's legacy gateway check for publishable keys; the function calls `auth.getUser` and rejects unauthenticated requests before reading a claim. The Gemini API request uses the documented `generateContent` JSON response schema; access and quotas must be verified with the project's own free-tier key.

## Try the complete journey

1. Sign in to two accounts. Add one as a friend by the eight-character ID and accept the request.
2. Create a claim with a future check time and select the friend. Each person writes an original answer. The final submission runs AI automatically. It should reject a subjective topic such as “Tomorrow's weather will be awesome” with specific feedback. The creator can revise the topic; this clears everyone's draft answers so they can submit again.
3. Create a concrete claim. When every active participant answers, the AI should create a neutral title, question, and choices, then lock the submitted answers. Within five minutes of the lock, edit only your own answer; AI should recheck it on submission. After five minutes, or at the check time if sooner, editing closes permanently.
4. At the check time, open **Notices** in both accounts, vote on the actual result, and inspect the settled record. With two different votes, the creator's vote decides after both vote. With three or more participants, more than half of all active members must choose the same outcome.
5. Open **Scores**. A correct friend gains one point against each wrong friend; two correct friends gain none against each other. Reloading must not add points.
6. Open **My profile** from the top-right corner. Add a personal title, bio, and optional profile photo; a friend should see them from your name in **Friends** or **Scores**. Sign out, choose **Forgot password?**, and use your sign-in email to test recovery. On an HTTPS deployment, open **My profile → Install on this device**. If the browser does not show a prompt, use **Add to Home Screen** or **Install app** in the browser menu.

The check time uses each phone's local timezone. If an unfinished claim passes its check time, its creator can extend the date in the record detail.

## Deploy without a paid app store

1. In Cloudflare **Workers & Pages**, choose **Create application → Pages → Import an existing Git repository** and select this repository.
2. Set production branch `main`, build command `npm run build`, and output directory `dist`.
3. Add build variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` using the public values from Supabase. Deploy to the supplied `*.pages.dev` HTTPS address.
4. In Supabase **Authentication → URL Configuration**, set the site URL to the deployed address and add the deployed origin and local development origin to allowed redirect URLs. Both email confirmation and password recovery links must return to the app.
5. Open the deployed app on a phone, sign in, and use its installation action. The installed app is a PWA, not an App Store or Play Store package.

Cloudflare's [React Pages guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/) confirms the Vite build command and `dist` output. Supabase's [function secrets guide](https://supabase.com/docs/guides/functions/secrets) explains private keys. The [Gemini pricing page](https://ai.google.dev/gemini-api/docs/pricing) lists the current free tier for Flash-Lite, subject to quota and region. Free Supabase projects can [pause after inactivity](https://supabase.com/docs/guides/platform/free-project-pausing); open the paused project in the Supabase Dashboard and click **Resume project** to reactivate it.

## Privacy and scoring

Row Level Security limits claim reads to active participants. Before locking, the claim-member RPC hides other people's draft answers. Only the server function can lock AI-approved wording. Votes go through one atomic database function, and scores are calculated from settled records, so refreshes cannot award a point twice. The PWA caches static app files only, never Supabase account or claim responses.

The server also enforces the five-minute answer correction deadline and verifies every edit with AI. Profile photo uploads are limited to the owner's folder and 2 MB, but the `profile-photos` bucket is public so a photo's URL can be viewed by anyone who has it. Supabase's default email sender has a low rate limit; if password emails stop arriving during a larger demo, configure a custom SMTP sender in Supabase Auth.

The profile title ladder is Newcomer (0 correct claims), Contender (1–4), Challenger (5–14), and Conqueror (15+). Friends can share a title. “None of these outcomes” can settle a claim but gives nobody a point.

## Development artifacts

The approved scope, requirements, spec, and build steps are in [`devpost/`](devpost). [`HANDOFF.md`](HANDOFF.md) records the previous session's context. The private learner profile and local `.env` are Git-ignored.
